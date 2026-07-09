import { APPLY_ESCALATION_ACTION, applyEscalation } from './escalation';
import type { EscalationLike, EvaluatedEscalation } from './escalation';
import { RISK_LEVEL } from './severity';
import { ESCALATION_STATUS, ESCALATION_TYPE } from './escalation';

function makeExisting(overrides: Partial<EscalationLike> = {}): EscalationLike {
	return {
		type: ESCALATION_TYPE.DEADLINE,
		ruleId: 'R-DEADLINE-48H',
		severity: RISK_LEVEL.HIGH,
		status: ESCALATION_STATUS.ACTIVE,
		...overrides,
	};
}

function makeEvaluated(overrides: Partial<EvaluatedEscalation> = {}): EvaluatedEscalation {
	return {
		type: ESCALATION_TYPE.DEADLINE,
		ruleId: 'R-DEADLINE-48H',
		severity: RISK_LEVEL.HIGH,
		reason: 'Review deadline within 48 hours',
		suggestedAction: 'Escalate to shift manager',
		...overrides,
	};
}

describe('applyEscalation', () => {
	it('inserts when there is no existing active escalation', () => {
		expect(applyEscalation(null, makeEvaluated())).toBe(APPLY_ESCALATION_ACTION.INSERT);
	});

	it('no-ops when the existing active escalation has the same severity', () => {
		const existing = makeExisting({ severity: RISK_LEVEL.HIGH });
		const evaluated = makeEvaluated({ severity: RISK_LEVEL.HIGH });

		expect(applyEscalation(existing, evaluated)).toBe(APPLY_ESCALATION_ACTION.NOOP);
	});

	it('no-ops when the existing active escalation has a higher severity', () => {
		const existing = makeExisting({ severity: RISK_LEVEL.CRITICAL, ruleId: 'R-DEADLINE-PASSED' });
		const evaluated = makeEvaluated({ severity: RISK_LEVEL.HIGH, ruleId: 'R-DEADLINE-48H' });

		expect(applyEscalation(existing, evaluated)).toBe(APPLY_ESCALATION_ACTION.NOOP);
	});

	it('supersedes the existing lower-severity escalation when the new one is higher (48h -> passed)', () => {
		const existing = makeExisting({ severity: RISK_LEVEL.HIGH, ruleId: 'R-DEADLINE-48H' });
		const evaluated = makeEvaluated({
			severity: RISK_LEVEL.CRITICAL,
			ruleId: 'R-DEADLINE-PASSED',
			reason: 'Review deadline passed',
			suggestedAction: 'Immediate manager escalation',
		});

		expect(applyEscalation(existing, evaluated)).toBe(APPLY_ESCALATION_ACTION.SUPERSEDE);
	});

	it('is idempotent: re-evaluating the same passed escalation again is a noop', () => {
		const existing = makeExisting({ severity: RISK_LEVEL.CRITICAL, ruleId: 'R-DEADLINE-PASSED' });
		const evaluated = makeEvaluated({
			severity: RISK_LEVEL.CRITICAL,
			ruleId: 'R-DEADLINE-PASSED',
			reason: 'Review deadline passed',
			suggestedAction: 'Immediate manager escalation',
		});

		expect(applyEscalation(existing, evaluated)).toBe(APPLY_ESCALATION_ACTION.NOOP);
	});
});
