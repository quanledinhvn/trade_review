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

**Rule** — one entry in `rules.config.json`. Defines _when_ to fire (`when`) and _what_ to create (`task` or `escalation`).

```typescript
type RuleTrigger =
	| 'missing_document'
	| 'wood_uncertified'
	| 'high_value'
	| 'deadline_approaching'
	| 'deadline_passed';

interface RuleDefinition {
	ruleId: string;
	version: number;
	enabled: boolean;
	reason: string;
	when: {
		trigger: RuleTrigger;
		params: Record<string, unknown>;
	};
	task?: RuleTaskOutcome; // task rules — 4 rules
	escalation?: RuleEscalationOutcome; // escalation rules — 2 rules
}
```

Example — task rule (`R-DOC-TRANSPORT`):

```json
{
	"ruleId": "R-DOC-TRANSPORT",
	"version": 1,
	"enabled": true,
	"reason": "transport_document is required but not completed",
	"when": {
		"trigger": "missing_document",
		"params": { "documentType": "transport_document" }
	},
	"task": {
		"severity": "critical",
		"title": "Missing transport document",
		"description": "The transport document (Bill of Lading / AWB) is required...",
		"suggestedAction": "Request transport document from partner",
		"assignedTeam": "trade_operations"
	}
}
```

Example — escalation rule (`R-DEADLINE-48H`):

```json
{
	"ruleId": "R-DEADLINE-48H",
	"version": 1,
	"enabled": true,
	"reason": "review deadline is within 48 hours",
	"when": {
		"trigger": "deadline_approaching",
		"params": { "hoursThreshold": 48 }
	},
	"escalation": {
		"type": "deadline",
		"severity": "high",
		"reason": "Review deadline within 48 hours",
		"suggestedAction": "Escalate to shift manager"
	}
}
```

### 3.1 Sequence

```mermaid
sequenceDiagram
    participant Op as Operator
    participant Ctrl as ReviewCasesController
    participant Svc as RuleEngineService
    participant CaseSvc as ReviewCasesService
    participant Dom as evaluate()
    participant DB as Database

    Op->>Ctrl: POST /review-cases/:id/run-rules
    Ctrl->>Svc: runRules(id, actor)
    Svc->>CaseSvc: resolveReviewCase(id)
    CaseSvc->>DB: find case by id or case_reference
    DB-->>CaseSvc: ReviewCase
    CaseSvc-->>Svc: ReviewCase
    alt status = completed
        Svc-->>Ctrl: 409 Conflict
        Ctrl-->>Op: cannot run rules
    else case active
        Svc->>Dom: evaluate(case, rules[], now)
        loop each enabled rule
            Dom->>Dom: PREDICATE_REGISTRY[when.trigger](case, params, now)
        end
        Dom-->>Svc: RuleResult[]
        Svc->>DB: $transaction
        Note over Svc,DB: persistNewTasks — skip if (case_id, rule_id) already exists
        Note over Svc,DB: persistEscalationChanges — supersede or insert active
        Note over Svc,DB: resolveCaseStatusAfterRules — in_review if active work, else completed
        Note over Svc,DB: syncCaseRiskRollup — set status, risk_level/risk_rank
        Note over Svc,DB: writeRuleExecutionAudits — rules_executed, task_created, escalation_*
        Note over Svc,DB: auditReviewCase(case_updated) if status changed
        Svc-->>Ctrl: { risk_level, tasks: count, escalations: active count }
        Ctrl-->>Op: 200 OK
    end
```

### 3.2 Pipeline

**Predicate** — a function that answers one question: _should this rule fire for this case?_
Returns `true` or `false`. No DB access.

```typescript
type Predicate = (
	reviewCase: ReviewCase,
	params: Record<string, unknown>, // from rules.config → when.params
	now?: Date,
) => boolean;
```

- **`reviewCase`** — case data loaded from DB (docs, packaging, invoice, deadline, …).
- **`params`** — per-rule settings from config. Same trigger, different params = different rules.
  e.g. `missing_document` uses `{ documentType: "transport_document" }`; `high_value` uses `{ threshold: 100000 }`.
- **`now`** — current time, used by deadline predicates.

```mermaid
flowchart TD
    Start([Start]) --> Case[ReviewCase]
    Config[rules.config] --> Eval[evaluate]
    Case --> Eval

    Eval --> Lookup[PREDICATE_REGISTRY]

    subgraph Registry [Predicate]
        direction TB
        P1[missing_document]
        P2[wood_uncertified]
        P3[high_value]
        P4[deadline_approaching]
        P5[deadline_passed]
    end

    Lookup -.-> Registry
    Lookup --> Results[RuleResult list]

    Results --> Apply[apply]
    Apply --> End([End])
```

### 3.3 Evaluation

```mermaid
flowchart TD
    Start([Start]) --> Input[ReviewCase]
    Config[rules.config] --> Loop[For each enabled rule]
    Input --> Loop

    Loop --> Lookup[PREDICATE_REGISTRY]
    Lookup --> Pred{Predicate true?}
    Pred -->|yes| Push[Push RuleResult]
    Pred -->|no| Skip[Skip rule]

    Push --> After
    Skip --> After

    After[All rules checked] --> Output[RuleResult list]
    Output --> End([End])
```

### 3.4 Apply

```mermaid
flowchart TD
    Start([Start]) --> Input[RuleResult list]
    Input --> Split{Outcome type?}

    Split -->|task| TCheck{Task exists?}
    TCheck -->|yes| TSkip[Skip task]
    TCheck -->|no| TInsert[Insert task]

    Split -->|escalation| ECheck{Active same type?}
    ECheck -->|none| EInsert[Insert escalation]
    ECheck -->|same or higher| ENoop[Noop]
    ECheck -->|lower| ESuper[Supersede]
    ESuper --> EInsert

    TInsert --> After
    TSkip --> After
    EInsert --> After
    ENoop --> After

    After[All outcomes processed] --> Rollup[Risk rollup]
    Rollup --> Audit[Audit log]
    Audit --> End([End])
```

### 3.5 Rules

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

