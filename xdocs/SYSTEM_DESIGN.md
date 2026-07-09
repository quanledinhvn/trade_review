# System Design

Companion to [README.md](../README.md) and [ASSUMPTIONS.md](ASSUMPTIONS.md). This
file covers component layout, data model (ERD), rule-engine flow, and state machines.

## 1. Component diagram

```mermaid
flowchart LR
    subgraph Client
        UI[apps/web<br/>task board]
        API_CLIENT[curl / API client]
    end

    subgraph apps/api [apps/api - NestJS]
        Controller[Controllers<br/>review-cases, tasks, work-queue]
        Service[Services]
        RuleEngine[Rule Engine<br/>evaluate -> apply]
        Audit[Audit Logger]
        Prisma[Prisma Client]
    end

    Config[(rules.config.json)]
    DB[(PostgreSQL)]

    UI --> Controller
    API_CLIENT --> Controller
    Controller --> Service
    Service --> RuleEngine
    Service --> Audit
    RuleEngine --> Config
    Service --> Prisma
    Audit --> Prisma
    Prisma --> DB
```

## 2. Data model (ERD)

```mermaid
erDiagram
    REVIEW_CASE ||--o{ TASK : has
    REVIEW_CASE ||--o{ ESCALATION : has
    REVIEW_CASE ||--o{ AUDIT_LOG : has

    REVIEW_CASE {
        string id PK
        string case_reference UK
        string shipment_reference
        string importer
        date arrival_date
        int review_window_days
        date deadline
        string status
        string risk_level
        int risk_rank
        string assigned_team
        string assigned_user
        string[] required_documents
        string[] completed_documents
        decimal invoice_value
        string packaging_type
        boolean ispm15_certified
    }

    TASK {
        string id PK
        string case_id FK
        string rule_id
        string title
        string reason
        string description
        string severity
        int severity_rank
        string suggested_action
        date due_date
        string assigned_team
        string assigned_user
        string status
        string resolution_comment
        string document_type
        json rule_snapshot
    }

    ESCALATION {
        string id PK
        string case_id FK
        string rule_id
        string type
        string severity
        string reason
        string suggested_action
        string status
        date resolved_at
        string resolved_reason
        json rule_snapshot
    }

    AUDIT_LOG {
        string id PK
        string case_id FK
        string action
        string entity_type
        string entity_id
        string summary
        json before
        json after
        string actor
        datetime created_at
    }
```

Notes:

- `TASK(case_id, rule_id)` is unique — one task per rule per case, so re-running rules
  never duplicates a task (idempotent).
- `ESCALATION` has a partial unique index on `(case_id, type) WHERE status = 'active'` —
  at most one active escalation per type per case.
- `risk_rank` / `severity_rank` are stored, not computed at query time, so `ORDER BY`
  can use an index instead of sorting in application code.

## 3. Rule engine flow

```mermaid
sequenceDiagram
    participant Op as Operator
    participant API as ReviewCasesController
    participant Engine as RuleEngine
    participant Cfg as rules.config.json
    participant DB as Database

    Op->>API: POST /review-cases/:id/run-rules
    API->>DB: load case (required/completed docs, packaging, deadline, invoice_value)
    API->>Engine: evaluate(case)
    Engine->>Cfg: load rule definitions
    loop each rule
        Engine->>Engine: check when.trigger + params against case
    end
    Engine-->>API: RuleOutcome[] (task or escalation candidates)
    API->>Engine: apply(outcomes)
    Engine->>DB: upsert tasks (case_id, rule_id) — skip if already open
    Engine->>DB: resolve superseded escalations, insert new active ones
    Engine->>DB: write audit_log entries (rule_execution, task_created, escalation)
    Engine->>DB: recompute risk_level/risk_rank (max severity of active tasks+escalations)
    API-->>Op: 200 OK (updated case)
```

7 rules, keyed by `when.trigger`:

| Trigger                | Rules                                                | Outcome                       |
| ---------------------- | ---------------------------------------------------- | ----------------------------- |
| `missing_document`     | commercial invoice, packing list, transport document | task (critical/high/critical) |
| `wood_uncertified`     | wooden packaging without ISPM-15 cert                | task (high)                   |
| `high_value`           | invoice value above threshold                        | task (management review)      |
| `deadline_approaching` | within 48h of deadline                               | escalation (high)             |
| `deadline_passed`      | past deadline                                        | escalation (critical)         |

## 4. State machines

### 4.1 Case status

```mermaid
stateDiagram-v2
    [*] --> open : POST /review-cases
    open --> in_review : first task/escalation created
    in_review --> completed : all tasks resolved, no active escalation
    completed --> [*]
```

`escalated` is **not** a state — it's derived from `EXISTS(active escalation)` and can be
true while status is `open` or `in_review`.

### 4.2 Task status

```mermaid
stateDiagram-v2
    [*] --> open : rule engine creates task
    open --> in_progress : operator starts work
    in_progress --> blocked : blocked on external input
    blocked --> in_progress : unblocked
    open --> completed : POST /tasks/:id/complete
    in_progress --> completed : POST /tasks/:id/complete
    blocked --> completed : POST /tasks/:id/complete
    completed --> [*]
    cancelled --> [*]
```

Completing a task with a `document_type` also appends it to the case's
`completed_documents`, so a later `run-rules` call won't recreate the same task.

### 4.3 Escalation lifecycle (resolve-then-insert)

```mermaid
stateDiagram-v2
    [*] --> active : rule fires (48h or passed)
    active --> resolved : case completed (case_completed)
    active --> resolved : superseded by a more severe rule
    resolved --> [*]
```

Only one `active` escalation per `type` per case at a time. When `deadline_passed` fires
while a `deadline_approaching` escalation is still active, the old row is resolved with
`resolved_reason = "superseded"` and a new `active` row is inserted — history is never
overwritten, only appended.

## 5. Risk roll-up

`RiskLevel` (case-wide) = highest `Severity` among the case's active tasks + active
escalations, using the shared rank:

```
critical = 40, high = 30, medium = 20, low = 10
```

If no active tasks/escalations remain, `risk_level` falls back to `low`.
