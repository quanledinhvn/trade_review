import { SEVERITY_RANK, type Severity } from './severity';
import type { EscalationStatus, EscalationType } from './types';

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
