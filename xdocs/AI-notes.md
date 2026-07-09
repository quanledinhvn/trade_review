# AI Tool Usage

## Tools

- **Cursor + Claude** — primary coding, docs, refactors
- **Context7 MCP** — library docs (NestJS, Prisma)

## AI-assisted

Boilerplate and first drafts: domain logic, NestJS modules/DTOs, `rules.config.json`, tests, frontend demo, README/xdocs. Design decisions and invariants were set manually from the take-home brief and `xdocs/`.

## Rejected AI suggestions

| AI suggestion                                                | Decision     | Reason                                                                |
| ------------------------------------------------------------ | ------------ | --------------------------------------------------------------------- |
| `escalated` as a stored case status                          | **Rejected** | Escalation is derived from active rows, not a lifecycle status        |
| `DELETE /review-cases/:id` or cancel flow                    | **Rejected** | No hard-delete; cases kept for audit                                  |
| Free-text packaging normalization (`"wooden crates"` → enum) | **Rejected** | Locked to snake_case enum input only (`wooden_crate`)                 |
| High-value review as an escalation                           | **Rejected** | Brief implies a manager **task**; deadline rules produce escalations  |
| Business-calendar deadline (skip weekends)                   | **Deferred** | Bonus feature; simple `arrival + N days` chosen for scope             |
| User/Team as DB entities + RBAC                              | **Deferred** | Plain string assignees + `X-Actor-Id` header sufficient for take-home |
| Auto-run rules on case create                                | **Rejected** | Explicit `POST .../run-rules` keeps creation and evaluation separate  |
