# API

**Local dev** (API + Vite): `http://localhost:3000/api` — the web app on `:5173` proxies
`/api` there via Vite.

**Docker** (`docker compose up`): `http://localhost:3001/api` — host port mapped from the
API container; the web app on `:8080` proxies `/api` internally.

**Errors** (4xx):

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": {} } }
```

| Code               | HTTP | When                                                               |
| ------------------ | ---- | ------------------------------------------------------------------ |
| `VALIDATION_ERROR` | 400  | Bad input                                                          |
| `FORBIDDEN`        | 403  | Actor not on assigned team or user                                 |
| `NOT_FOUND`        | 404  | Missing resource                                                   |
| `CONFLICT`         | 409  | Invalid state (duplicate reference, terminal task, completed case) |

---

## `POST /review-cases`

Create case. System sets `deadline`, `status` (`open`), `risk_level` (`low`).

**Headers**:

- `X-Actor-Id: alice`
- `X-Actor-Team: trade_operations`

**Body**:

```json
{
	"case_reference": "REV-2026-0119",
	"shipment_reference": "SAF-TIME-2026-0119",
	"importer": "Eastland Retail Group",
	"arrival_date": "2026-07-01",
	"review_window_days": 7,
	"invoice_value": 125000,
	"packaging_type": "wooden_crate",
	"ispm15_certified": false,
	"required_documents": ["commercial_invoice", "packing_list", "transport_document"],
	"completed_documents": ["commercial_invoice"],
	"assigned_team": "trade_operations",
	"assigned_user": null
}
```

All fields required except `assigned_user`. `completed_documents` must be a subset of `required_documents`. `review_window_days` must be ≥ 1.

**Response** `201`:

```json
{
	"id": "uuid",
	"case_reference": "REV-2026-0119",
	"shipment_reference": "SAF-TIME-2026-0119",
	"importer": "Eastland Retail Group",
	"arrival_date": "2026-07-01",
	"review_window_days": 7,
	"deadline": "2026-07-08",
	"status": "open",
	"risk_level": "low",
	"risk_rank": 10,
	"invoice_value": 125000,
	"packaging_type": "wooden_crate",
	"ispm15_certified": false,
	"required_documents": ["commercial_invoice", "packing_list", "transport_document"],
	"completed_documents": ["commercial_invoice"],
	"assigned_team": "trade_operations",
	"assigned_user": null,
	"created_at": "2026-07-01T09:00:00.000Z",
	"updated_at": "2026-07-01T09:00:00.000Z",
	"time_remaining_hours": 168,
	"escalations": []
}
```

`409` if `case_reference` already exists.

---

## `GET /review-cases/:id`

Full case plus all escalations (active and resolved). No body.

**Response** `200` — same fields as create, plus `escalations`:

```json
{
	"id": "uuid",
	"case_reference": "REV-2026-0119",
	"status": "in_review",
	"risk_level": "critical",
	"risk_rank": 40,
	"deadline": "2026-07-08",
	"time_remaining_hours": 36,
	"escalations": [
		{
			"id": "uuid",
			"rule_id": "R-DEADLINE-48H",
			"type": "deadline",
			"severity": "high",
			"reason": "Review deadline within 48 hours",
			"suggested_action": "Notify assigned team of approaching deadline",
			"status": "active",
			"resolved_reason": null,
			"created_at": "2026-07-06T21:00:00.000Z"
		}
	]
}
```

---

## `POST /review-cases/:id/run-rules`

Evaluate rules, create or update tasks and escalations, move case to `in_review`. Idempotent.

**Headers**:

- `X-Actor-Id: system`
- `X-Actor-Team: trade_operations`

**Body**: none

**Response** `200`:

```json
{ "risk_level": "critical", "tasks": 4, "escalations": 1 }
```

`tasks` = open tasks after run. `escalations` = active escalations after run.

`409` on completed case.

---

## `GET /review-cases/:id/tasks`

List tasks. No body.

**Query** (optional):

```
?status=open
```

Values: `open` · `in_progress` · `blocked` · `completed` · `cancelled`

Sorted: severity descending, then due date ascending.

**Response** `200`:

```json
[
	{
		"id": "uuid",
		"case_id": "uuid",
		"rule_id": "R-DOC-TRANSPORT",
		"title": "Missing transport document",
		"reason": "transport_document is required but not completed",
		"description": "Transport document (bill of lading / airway bill) not received.",
		"severity": "critical",
		"severity_rank": 40,
		"suggested_action": "Request transport document from partner",
		"due_date": "2026-07-08",
		"assigned_team": "trade_operations",
		"assigned_user": null,
		"status": "open",
		"document_type": "transport_document",
		"resolution_comment": null,
		"created_at": "2026-07-06T21:00:00.000Z",
		"updated_at": "2026-07-06T21:00:00.000Z"
	}
]
```

---

## `POST /tasks/:id/complete`

**Headers**:

- `X-Actor-Id: bob`
- `X-Actor-Team: trade_operations`

Actor team must match task `assigned_team`. If task has `assigned_user`, actor id must match too.

**Body**:

```json
{
	"resolution_comment": "Received signed bill of lading from carrier."
}
```

`resolution_comment` is optional. Empty body `{}` is valid.

**Response** `200`:

```json
{
	"id": "uuid",
	"status": "completed",
	"resolution_comment": "Received signed bill of lading from carrier.",
	"updated_at": "2026-07-07T10:15:00.000Z",
	"document_completed": "transport_document"
}
```

`document_completed` present only when task has `document_type` — document is added to case `completed_documents`.

`409` if task is `completed` or `cancelled`.

---

## `POST /tasks/:id/reassign`

**Headers**:

- `X-Actor-Id: alice`
- `X-Actor-Team: trade_operations`

Actor team must match current task `assigned_team`. If task has `assigned_user`, actor id must match too.

**Body**:

```json
{
	"assigned_team": "customs_brokerage",
	"assigned_user": "carol"
}
```

`assigned_team` required. `assigned_user` optional — omit or set `null` for team-only assignment.

**Response** `200` — full task object (same shape as list).

---

## `GET /work-queue`

Cases with `status = in_review` only. No body.

**Query** (all optional):

```
?sort=risk&deadline=approaching&assigned_team=trade_operations&assigned_user=alice&page=1&limit=20
```

| Param           | Values                                 | Default |
| --------------- | -------------------------------------- | ------- |
| `sort`          | `risk` · `deadline`                    | `risk`  |
| `deadline`      | `all` · `approaching` (< 48h) · `past` | `all`   |
| `assigned_team` | string                                 | —       |
| `assigned_user` | string                                 | —       |
| `page`          | integer ≥ 1                            | `1`     |
| `limit`         | integer 1–100                          | `20`    |

Sort uses numeric `risk_rank`, not alphabetical.

**Response** `200`:

```json
{
	"total": 1,
	"items": [
		{
			"case_reference": "REV-2026-0119",
			"risk_level": "critical",
			"deadline": "2026-07-08",
			"time_remaining_hours": 36,
			"open_tasks": [
				{
					"title": "Missing transport document",
					"severity": "critical",
					"status": "open",
					"suggested_action": "Request transport document from partner"
				}
			],
			"escalations": [{ "severity": "high", "reason": "Review deadline within 48 hours" }]
		}
	]
}
```

`open_tasks` = open tasks only. `escalations` = active only.

---

## Enums

**document_type**: `commercial_invoice` · `packing_list` · `transport_document` · `ispm15_certificate` · `certificate_of_origin`

**packaging_type**: `wooden_pallet` · `wooden_crate` · `natural_wood_box` · `wooden_bundle` · `wooden_box_ordinary` · `reconstituted_wood_box` · `fibreboard_box` · `plastic_box` · `cardboard_crate` · `pallet_generic`

**case status**: `open` · `in_review` · `completed`

**task status**: `open` · `in_progress` · `blocked` · `completed` · `cancelled`

**escalation status**: `active` · `resolved`

**severity / risk_level**: `critical` · `high` · `medium` · `low`
