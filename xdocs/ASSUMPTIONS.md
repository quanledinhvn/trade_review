# Assumptions & Design Decisions

Source: `docs/se-safiri-take_home_2.md`. Each section lists what the brief requires vs what we assumed.

---

## 1. Severity & Risk Level

**docs**

- Sample output shows `risk_level: "critical"`

**assumptions**

- **Severity** (task/escalation) and **RiskLevel** (case) share `critical | high | medium | low`
- Risk = max severity of active tasks + escalations; fallback `low`
- Rank `critical=40…low=10` stored in DB (`risk_rank`, `severity_rank`) for indexed sort

## 2. Case Status & Lifecycle

**docs**

- Task statuses defined; case statuses not

**assumptions**

- **CaseStatus**: `open → in_review → completed`
- `run-rules` → `in_review`; all tasks terminal → `completed`
- `escalated` derived from active escalations, not a stored status

## 3. Documents

**docs**

- Required/completed documents on the case

**assumptions**

- Fixed `DocumentType` enum
- `completedDocuments ⊆ requiredDocuments` (validated on input)
- Missing set derived; drives missing-document rules

## 4. Packaging & ISPM-15

**docs**

- Packaging type and ISPM-15 certification drive the wood rule

**assumptions**

- `PackagingType` snake_case enum with UN/ECE Rec 21 metadata
- Wood rule checks solid-wood types only (`isWoodPackaging()`)
- `ispm15Certified` is an explicit boolean, not inferred from documents
- Enum input only (`wooden_crate`) — no free-text normalization

## 5. Derived Fields

**docs**

- Deadline = `arrivalDate + reviewWindowDays`
- Time remaining, approaching (< 48h), passed

**assumptions**

- `status`, `riskLevel`, `time_remaining_hours` also system-managed
- Business-calendar deadline (skip weekends/holidays) deferred as bonus

## 6. Task Workflow

**docs**

- Statuses: `open | in_progress | blocked | completed | cancelled`
- Task `description` required

**assumptions**

- `title` / `reason` / `description` — description from rule config
- Completing a document task syncs `completedDocuments` (keeps `run-rules` idempotent)
- No file upload — only `resolution_comment`

## 7. Escalations

**docs**

- Deadline approaching (48h) and passed produce escalations with severity + reason + audit

**assumptions**

- Separate table; `active | resolved`; type `deadline` only
- High-value review is a **task** (`management`), not an escalation
- One active per type — resolve-then-insert (`superseded`); history retained
- Case complete resolves active escalations (`case_completed`)

## 8. Rule Engine

**docs**

- 7 rules: 5 tasks + 2 deadline escalations

**assumptions**

- Loaded from `rules.config.json` at startup
- Config (`when → outcome`) + TypeScript predicates (registry by `when.trigger`)
- `evaluate` (pure) → `apply` (idempotent writes)
- `rule_snapshot` = frozen full `RuleDefinition` per task/escalation; unique `(case_id, rule_id)` prevents duplicate tasks

## 9. Audit & Actors

**docs**

- Audit: case creation, rule runs, task create/complete, reassignment, escalation, status changes

**assumptions**

- Append-only; `before`/`after` JSONB per case
- No User/Team models — plain strings
- `actor` from `X-Actor-Id` header (`"system"` for rule engine)
- Team required, user optional

## 10. API

**docs**

- 8 endpoints

**assumptions**

- No `DELETE` or cancel endpoint
- Create case does not auto-run rules
- Detail: full case + escalations; tasks via separate endpoint
- Work queue: `in_review` only; paginated; filter `deadline` / `assigned_team` / `assigned_user`; sort `risk` or `deadline`
- Errors: `{ error: { code, message, details? } }` — 400 / 404 / 409

## 11. Database

**assumptions**

- 4 tables: `review_cases`, `tasks`, `escalations`, `audit_logs`
- Partial unique index: `(case_id, type) WHERE status = 'active'`
- No `rules` or `users`/`teams` tables
