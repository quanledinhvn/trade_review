export const ESCALATION_STATUS = {
	ACTIVE: 'active',
	RESOLVED: 'resolved',
} as const;

export type EscalationStatus = (typeof ESCALATION_STATUS)[keyof typeof ESCALATION_STATUS];

export const ESCALATION_TYPE = {
	DEADLINE: 'deadline',
} as const;

export type EscalationType = (typeof ESCALATION_TYPE)[keyof typeof ESCALATION_TYPE];

export const RESOLVED_REASON = {
	CASE_COMPLETED: 'case_completed',
	SUPERSEDED: 'superseded',
} as const;

export type ResolvedReason = (typeof RESOLVED_REASON)[keyof typeof RESOLVED_REASON];
