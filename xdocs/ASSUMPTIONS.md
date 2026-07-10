# Assumptions & Design Decisions

This document explains the product terms, where each record comes from, and what is derived by the system.

---

## 1. Review Case

A **review case** is the central record for one shipment trade review. It is created by an operator/API client from the shipment input, then the rule engine derives follow-up work from it.

### Source of creation

- Created by `POST /review-cases`.
- Creation does **not** automatically run rules. The caller must explicitly call `POST /review-cases/:id/run-rules`.
- `case_reference` is provided by the caller and must be unique.
- The system writes a `CASE_CREATED` audit event during creation.

### Status

The brief defines task statuses but does not define case statuses, so case status is modeled as one progress axis:

- `open`: case exists, but rules have not produced active work yet.
- `in_review`: at least one active task or active escalation exists.
- `completed`: no active task or active escalation remains.

Important decisions:

- A review case does not have an `escalated` status. Escalation state comes only from active rows in `escalations`.
- A clean case can move `open → completed` directly after `run-rules` if no rule creates active work.
- A case with work moves `open → in_review`.
- A case moves `in_review → completed` when all tasks are terminal and all escalations are resolved.
- Completed cases cannot run rules again.
- The work queue only includes `in_review` cases.

### Related data on the case

Input fields:

- Shipment identity: `case_reference`, `shipment_reference`, `importer`.
- Timing: `arrival_date`, `review_window_days`.
- Assignment: `assigned_team`, optional `assigned_user`.
- Documents: `required_documents`, `completed_documents`.
- Shipment risk inputs: `invoice_value`, `packaging_type`, `ispm15_certified`.

System-managed fields:

- `deadline` = `arrival_date + review_window_days`.
- `status`.
- `risk_level`.
- `risk_rank`.
- `time_remaining_hours` in API responses.

Document assumptions:

- A **document** is business evidence needed to review and clear the shipment.
- `DocumentType` is the controlled list of document names accepted by the API, such as `commercial_invoice`, `packing_list`, and `transport_document`.
- The controlled list is modeled as a fixed enum because rules depend on exact document names.
- `required_documents` means documents the case needs before review can be completed.
- `completed_documents` means required documents already received or verified.
- `completed_documents` must be a subset of `required_documents`.
- `missing_documents` means required documents that are not completed yet. It is derived, not stored.
- Missing documents drive the `missing_document` rules.

Packaging assumptions:

- **Packaging** describes the physical material/form used to pack the shipment.
- `PackagingType` is the controlled list of packaging values accepted by the API, such as `wooden_crate`, `wooden_pallet`, and `plastic_box`.
- Packaging values use snake_case so API input, database storage, and rule config use one stable format.
- Packaging metadata such as UN/ECE Rec 21 code and ISPM-15 relevance lives in code/reference data, not on the case row.
- The wood rule only cares whether the packaging is solid wood. That check is centralized in `isWoodPackaging()`.
- `ispm15_certified` means the shipment has confirmed ISPM-15 certification for relevant wood packaging.
- `ispm15_certified` is the source of truth for certification, not inferred from documents.
- The API accepts enum values such as `wooden_crate`; no free-text normalization is supported.

Date/time assumptions:

- `arrival_date` is the shipment arrival date used to start the review window.
- `review_window_days` is the allowed number of calendar days for the review.
- `deadline` is the system-calculated final review date: `arrival_date + review_window_days`.
- `time_remaining_hours` is derived from the current time and the case deadline.
- Date-only fields are parsed as UTC dates.
- No IANA timezone, DST handling, weekend skipping, holiday calendar, or business-calendar deadline calculation is implemented.

---

## 2. Task

A **task** is actionable work assigned to a team or user. Tasks are not created manually in this design; they are created by task-producing rules.

### Source of creation

- Created only during `POST /review-cases/:id/run-rules`.
- A matched rule with a `task` outcome creates one task.
- Current task-producing rules:
  - `R-DOC-INVOICE`: missing commercial invoice.
  - `R-DOC-PACKING`: missing packing list.
  - `R-DOC-TRANSPORT`: missing transport document.
  - `R-WOOD-ISPM15`: solid-wood packaging without ISPM-15 certification.
  - `R-HIGH-VALUE`: invoice value above the manager-review threshold.

### Stored task data

Each task stores:

- `case_id`: parent review case.
- `rule_id`: rule that created the task.
- `title`, `reason`, `description`, `suggested_action`: copied from the matched rule.
- `severity` and `severity_rank`.
- `due_date`: the case deadline.
- `assigned_team`, optional `assigned_user`.
- `status`.
- Optional `document_type` for document tasks.
- `rule_snapshot`: frozen copy of the full rule definition that produced the task.
- Optional `resolution_comment`.

### Status and lifecycle

Task statuses:

- `open`
- `in_progress`
- `blocked`
- `completed`
- `cancelled`

Lifecycle assumptions:

- New tasks start as `open`.
- `open`, `in_progress`, and `blocked` are active statuses.
- `completed` and `cancelled` are terminal statuses.
- Completing a document task also syncs that document into the case `completed_documents`, so a later rule run remains idempotent.
- There is no file upload flow; completion accepts a `resolution_comment`.
- Reassignment is supported by storing team/user strings, not by user/team tables.

### Idempotency

- The database enforces one task per `(case_id, rule_id)`.
- Re-running rules does not create duplicate tasks for the same case and rule.
- Existing tasks are preserved rather than overwritten.

---

## 3. Escalation

An **escalation** is a time-sensitive warning that the review deadline is near or missed. It is separate from case status and task status.

### Source of creation

- Created only during `POST /review-cases/:id/run-rules`.
- A matched rule with an `escalation` outcome creates or updates an escalation.
- Current escalation-producing rules:
  - `R-DEADLINE-48H`: deadline is within 48 hours, creates a `high` deadline escalation.
  - `R-DEADLINE-PASSED`: deadline has passed, creates a `critical` deadline escalation.

### Stored escalation data

Each escalation stores:

- `case_id`: parent review case.
- `rule_id`: rule that created the escalation.
- `type`: currently only `deadline`.
- `severity`.
- `reason`.
- `suggested_action`.
- `status`.
- Optional `resolved_at` and `resolved_reason`.
- `rule_snapshot`: frozen copy of the full rule definition that produced the escalation.

### Status and lifecycle

Escalation statuses:

- `active`
- `resolved`

Lifecycle assumptions:

- Only one active escalation per `(case_id, type)` is allowed.
- If a more severe escalation of the same type fires, the existing active row is resolved with `resolved_reason = "superseded"`, then a new active row is inserted.
- If the same or lower-severity escalation already exists, rule apply is a noop.
- When the case is completed, active escalations are resolved with `resolved_reason = "case_completed"`.
- History is retained; escalation rows are not overwritten or deleted.

High-value review is deliberately a **task** assigned to `management`, not an escalation.

---

## 4. Rule Engine

The **rule engine** turns review-case facts into tasks and escalations. It is split into pure evaluation and idempotent persistence.

### Source of rules

- A **rule** is a configured business check that can produce either a task or an escalation.
- Rules are loaded from `apps/api/src/config/rules.config.json` at API startup.
- Each rule has:
  - `ruleId`
  - `version`
  - `enabled`
  - `reason`
  - `when`
  - either `task` or `escalation`
- `when` describes the condition that decides whether the rule fires.
- `when.trigger` is the named condition type, such as `missing_document` or `deadline_passed`.
- A **predicate** is the TypeScript function that evaluates one trigger against the review case.
- `when.trigger` selects a predicate from `PREDICATE_REGISTRY`.
- `when.params` supplies configurable values for that predicate, such as `documentType`, `threshold`, or `hoursThreshold`.

### Current triggers

- `missing_document`
- `wood_uncertified`
- `high_value`
- `deadline_approaching`
- `deadline_passed`

### Evaluation phase

`evaluate(reviewCase, rules, now)` is pure:

- It reads case facts and rule config.
- It checks each enabled rule predicate.
- It returns matched `RuleResult[]`.
- It does not write to the database.

### Apply phase

`applyRuleResults` runs inside a database transaction:

- Splits matched results into task outcomes and escalation outcomes.
- Creates missing tasks, skipping existing `(case_id, rule_id)` tasks.
- Creates, supersedes, or noops escalations based on active escalation state.
- Reloads all case tasks and escalations.
- Resolves case status from active work.
- Rolls up case risk from active tasks and active escalations.
- Writes audit events.

### What is created or updated after rules run

After `run-rules`, the system may create:

- New `tasks`.
- New `escalations`.
- New `audit_logs`.

It may update:

- Existing active escalations, when superseded.
- The parent review case `status`.
- The parent review case `risk_level` and `risk_rank`.

It does not create:

- Review cases.
- Rules in the database.
- Users or teams.

### Severity and risk roll-up

Two related concepts share the same four-level scale:

- **Severity** describes how serious one task or escalation is.
- **RiskLevel** describes the overall current risk of the review case.

Scale:

- `critical`
- `high`
- `medium`
- `low`

Ranking:

- `critical = 40`
- `high = 30`
- `medium = 20`
- `low = 10`

Risk roll-up:

- `risk_level` stores the case `RiskLevel`.
- The case `RiskLevel` is the highest severity among active tasks and active escalations.
- If there is no active work, `risk_level` falls back to `low`.
- `risk_rank` and `severity_rank` are stored to support indexed sorting.

### Audit and actors

Audit assumptions:

- An **audit log** is an immutable event describing a meaningful change to a review case, task, or escalation.
- An **actor** is the user/system identifier responsible for the action.
- Audit logs are append-only.
- Important actions write audit events: case creation, rules executed, task created/completed, reassignment, escalation created/superseded, and case status changes.
- `RULES_EXECUTED` is separate from `CASE_UPDATED`; both can appear in one run.
- Idempotent re-runs do not write duplicate task-created events.
- `before` and `after` are stored as JSON.
- Actor comes from `X-Actor-Id`; system-created work uses `"system"`.

---

## 5. User and Team

A **user** is an operator identifier used for assignment and audit. A **team** is an operational group responsible for work. In this take-home scope, both are references, not domain models.

Assumptions:

- There is no `users` table.
- There is no `teams` table.
- `assigned_team` is stored as a plain string on review cases and tasks.
- `assigned_user` is stored as an optional plain string.
- `actor` is read from request headers and stored as a plain string in audit logs.
- Authorization is intentionally lightweight: task actions check the actor against the assigned team/user strings.
- Role-based permissions, membership lookup, team hierarchy, and user lifecycle are out of scope.

---

## 6. API

The API exposes review-case creation, rule execution, task handling, work queue, and audit visibility.

This section only summarizes what each API does. Request/response details and examples live in `xdocs/API.md`.

### Endpoints

- `POST /review-cases`: creates a review case, calculates system-managed fields, and writes the creation audit log. It does not run rules.
- `GET /review-cases`: lists review cases for browsing/searching outside the work queue.
- `GET /review-cases/:id`: returns review case detail, including escalation history.
- `POST /review-cases/:id/run-rules`: evaluates rules for a case, then creates or updates tasks, escalations, status, risk, and audit logs.
- `GET /review-cases/:id/tasks`: lists tasks for one review case, optionally filtered by task status.
- `POST /tasks/:id/complete`: completes a task, records the resolution comment, syncs document completion when applicable, and may complete the parent case.
- `POST /tasks/:id/reassign`: changes task assignment to another team/user string and writes audit history.
- `GET /work-queue`: returns only `in_review` cases for operator work, with filtering, pagination, and risk/deadline sorting.

### API constraints

- API docs are the source of truth for payload shape, examples, and error responses.
- There is no delete endpoint for review cases.
- There is no rule-management API.
- There is no user/team-management API.

---

## 7. Database

The database stores operational state and audit history. Rules remain file-configured, not database-configured.

### Tables

Core tables:

- `review_cases`
- `tasks`
- `escalations`
- `audit_logs`

No tables:

- No `rules` table.
- No `users` table.
- No `teams` table.

### Relationships

- One `review_case` has many `tasks`.
- One `review_case` has many `escalations`.
- One `review_case` has many `audit_logs`.

## 8. Scope Boundaries

Implemented scope:

- Configurable file-based rules.
- Deterministic task and escalation creation.
- Case risk roll-up.
- Case status derivation from active work.
- Audit trail.
- Work queue.

Deliberately out of scope:

- Hard-delete of review cases.
- Rule administration UI/API.
- User/team management.
- File upload.
- Business-calendar deadline logic.
- Timezone-specific deadline behavior.
