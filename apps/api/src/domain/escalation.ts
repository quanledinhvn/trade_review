import { SEVERITY_RANK, type Severity } from './severity';

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

export const APPLY_ESCALATION_ACTION = {
	NOOP: 'noop',
	INSERT: 'insert',
	SUPERSEDE: 'supersede',
} as const;

export type ApplyEscalationAction =
	(typeof APPLY_ESCALATION_ACTION)[keyof typeof APPLY_ESCALATION_ACTION];

export interface EscalationLike {
	type: EscalationType;
	ruleId: string;
	severity: Severity;
	status: EscalationStatus;
}

export interface EvaluatedEscalation {
	type: EscalationType;
	ruleId: string;
	severity: Severity;
	reason: string;
	suggestedAction: string;
}

export function applyEscalation(
	existingActive: EscalationLike | null,
	evaluated: EvaluatedEscalation,
): ApplyEscalationAction {
	if (!existingActive) {
		return APPLY_ESCALATION_ACTION.INSERT;
	}

	if (SEVERITY_RANK[existingActive.severity] >= SEVERITY_RANK[evaluated.severity]) {
		return APPLY_ESCALATION_ACTION.NOOP;
	}

	return APPLY_ESCALATION_ACTION.SUPERSEDE;
}
