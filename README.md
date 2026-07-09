# Shipment Trade Review Service

Backend service for time-sensitive shipment trade review: rule engine, deadlines/risk
levels, review tasks, escalation, work queue, audit log.

- Design decisions: [xdocs/ASSUMPTIONS.md](xdocs/ASSUMPTIONS.md)
- System design (diagrams, ERD, state machines): [xdocs/SYSTEM_DESIGN.md](xdocs/SYSTEM_DESIGN.md)
- Full API documentation & example requests: [xdocs/API.md](xdocs/API.md)
- AI usage: [xdocs/AI-notes.md](xdocs/AI-notes.md)

## Live deployment

- **Web UI:** [trade-review-web-omega.vercel.app/work-queue](https://trade-review-web-omega.vercel.app/work-queue)
- **API:** [p01--tradereview--gcjg8dny5mt5.code.run/api](https://p01--tradereview--gcjg8dny5mt5.code.run/api) — health check: [`/api/health`](https://p01--tradereview--gcjg8dny5mt5.code.run/api/health)

## Stack

- `apps/api` — NestJS + Prisma + PostgreSQL + Winston.
- `apps/web` — React + Vite + TanStack Router + shadcn/ui + Zustand (demo UI only).

## Quick start

```bash
pnpm install
docker compose -f docker-compose.db.yml up -d      # Postgres
cp apps/api/.env.example apps/api/.env               # set DATABASE_URL
cp apps/web/.env.example apps/web/.env               # optional: VITE_MOCK=true for offline UI
pnpm --filter @app/api exec prisma migrate dev
pnpm --filter @app/api prisma:seed                   # seeds case REV-2026-0119
pnpm --filter @app/api dev                           # API on :3000 (prefix /api)
pnpm --filter @app/web dev                           # Web on :5173 (proxies /api → :3000)
```

Full stack via Docker: `docker compose up --build` (web `:8080`, API `:3001`).

## Tests

```bash
pnpm --filter @app/api test         # unit: rules, deadline calc, escalation, roll-up
pnpm --filter @app/api test:e2e     # end-to-end: seed case work-queue flow
```

## API

Endpoints, request/response shapes, and curl examples: [xdocs/API.md](xdocs/API.md).

## Rule engine

7 rules, loaded from `apps/api/rules.config.json` (versioned, hot-editable, no redeploy
needed): 3 missing-document rules, wood-uncertified, high-value review (tasks); deadline
48h and deadline-passed (escalations). Each rule outputs `rule_id`, `reason`, `severity`,
`suggested_action`. `run-rules` is idempotent — re-running never duplicates tasks/escalations.

## Architecture

Component diagram, ERD, rule-engine flow, and state machines:
[xdocs/SYSTEM_DESIGN.md](xdocs/SYSTEM_DESIGN.md). Assumptions and rationale:
[xdocs/ASSUMPTIONS.md](xdocs/ASSUMPTIONS.md).

## What I done

| Area                      | Status                                                               |
| ------------------------- | -------------------------------------------------------------------- |
| Workflow understanding    | ✅ Done                                                              |
| Data modelling            | ✅ Done — full Prisma schema (cases, tasks, escalations, audit_logs) |
| Rule engine design        | ✅ Done — JSON-config engine, 7 rules, idempotent `run-rules`        |
| Deadline and risk logic   | ✅ Done — deadline/time-remaining calc + risk roll-up                |
| API and work queue design | ✅ Done — all 9 endpoints incl. work queue filter/sort/pagination    |
| Testing                   | ✅ Done — rule, deadline, escalation, task, queue-ordering tests     |
| Auditability              | ✅ Done — append-only audit log + `GET .../audit-log`                |
| Documentation             | ✅ Done — README, xdocs/                                             |

Bonus features done:

- ✅ Configurable rules loaded from JSON.
- ✅ Rule versioning.
- ✅ Simple frontend task board.

Bonus features not attempted: business calendar, notification simulation, SLA metrics
API, role-based permissions.

## Trade-offs

- **Rules in JSON, not DB.** Fast to edit/version, no admin API needed — but no live
  reload or per-tenant rules without a redeploy.
- **User/Team deferred.** `assigned_user`/`assigned_team`/`actor` are plain strings, not
  FKs — simpler now, but no role-based permissions until those become real entities.
- **Business-calendar deadlines skipped.** Deadline = `arrival_date + review_window_days`
  only; weekend/holiday-aware scheduling is left as a bonus, not implemented.
- **No document upload.** Task completion takes a `resolution_comment` only, no file/ref
  — matches the brief, but ties completion to trust rather than verifiable evidence.
- **Sync `run-rules`.** Runs in-request — simple, instant result. Slow when rules grow; scale with BullMQ workers later.
