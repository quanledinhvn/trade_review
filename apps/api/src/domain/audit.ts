export const AUDIT_ACTION = {
	CASE_CREATED: 'case_created',
	CASE_UPDATED: 'case_updated',
	RULES_EXECUTED: 'rules_executed',
	TASK_CREATED: 'task_created',
	TASK_COMPLETED: 'task_completed',
	TASK_REASSIGNED: 'task_reassigned',
	ESCALATION_CREATED: 'escalation_created',
	ESCALATION_SUPERSEDED: 'escalation_superseded',
	ESCALATION_RESOLVED: 'escalation_resolved',
} as const;

export const AUDIT_ENTITY_TYPE = {
	CASE: 'case',
	TASK: 'task',
	ESCALATION: 'escalation',
} as const;

export type AuditEntityType = (typeof AUDIT_ENTITY_TYPE)[keyof typeof AUDIT_ENTITY_TYPE];
