import {
	computeRiskRollup,
	deadlineApproachingPredicate,
	deadlinePassedPredicate,
	evaluate,
	highValuePredicate,
	missingDocumentPredicate,
	missingDocuments,
	woodUncertifiedPredicate,
} from './rule-engine';
import type { RuleDefinition } from './rules-config';
import type { ReviewCaseLike } from './rule-engine';
import { RISK_LEVEL, SEVERITY_RANK } from './severity';
import { TASK_STATUS } from './task-status';
import { DOCUMENT_TYPE } from './document-type';
import { ESCALATION_STATUS } from './escalation';
import { PACKAGING_TYPE } from './packaging';

const NOW = new Date('2026-07-09T00:00:00.000Z');

function hoursFromNow(hours: number): Date {
	return new Date(NOW.getTime() + hours * 3_600_000);
}

function makeCase(overrides: Partial<ReviewCaseLike> = {}): ReviewCaseLike {
	return {
		requiredDocuments: [
			DOCUMENT_TYPE.COMMERCIAL_INVOICE,
			DOCUMENT_TYPE.PACKING_LIST,
			DOCUMENT_TYPE.TRANSPORT_DOCUMENT,
		],
		completedDocuments: [DOCUMENT_TYPE.COMMERCIAL_INVOICE],
		packagingType: PACKAGING_TYPE.WOODEN_CRATE,
		ispm15Certified: false,
		invoiceValue: 125000,
		deadline: hoursFromNow(36),
		...overrides,
	};
}

describe('missingDocuments', () => {
	it('returns required documents minus completed documents', () => {
		const c = makeCase();

		expect(missingDocuments(c)).toEqual([
			DOCUMENT_TYPE.PACKING_LIST,
			DOCUMENT_TYPE.TRANSPORT_DOCUMENT,
		]);
	});

	it('returns empty array when all documents are completed', () => {
		const c = makeCase({
			requiredDocuments: [DOCUMENT_TYPE.COMMERCIAL_INVOICE],
			completedDocuments: [DOCUMENT_TYPE.COMMERCIAL_INVOICE],
		});

		expect(missingDocuments(c)).toEqual([]);
	});
});

describe('predicates', () => {
	it('missing_document matches when documentType is missing', () => {
		const c = makeCase();

		expect(missingDocumentPredicate(c, { documentType: DOCUMENT_TYPE.TRANSPORT_DOCUMENT })).toBe(
			true,
		);

		expect(missingDocumentPredicate(c, { documentType: DOCUMENT_TYPE.COMMERCIAL_INVOICE })).toBe(
			false,
		);
	});

	it('wood_uncertified matches for solid-wood packaging without certification', () => {
		const c = makeCase({ packagingType: PACKAGING_TYPE.WOODEN_CRATE, ispm15Certified: false });

		expect(woodUncertifiedPredicate(c, {})).toBe(true);
	});

	it('wood_uncertified does not match when already certified', () => {
		const c = makeCase({ packagingType: PACKAGING_TYPE.WOODEN_CRATE, ispm15Certified: true });

		expect(woodUncertifiedPredicate(c, {})).toBe(false);
	});

	it('wood_uncertified does not match reconstituted_wood_box (processed wood, ISPM-15 exempt)', () => {
		const c = makeCase({
			packagingType: PACKAGING_TYPE.RECONSTITUTED_WOOD_BOX,
			ispm15Certified: false,
		});

		expect(woodUncertifiedPredicate(c, {})).toBe(false);
	});

	it('high_value matches when invoiceValue exceeds threshold', () => {
		const c = makeCase({ invoiceValue: 125000 });

		expect(highValuePredicate(c, { threshold: 100000 })).toBe(true);

		expect(highValuePredicate(c, { threshold: 200000 })).toBe(false);
	});

	describe('deadline_approaching', () => {
		const params = { hoursThreshold: 48 };

		it('matches at 36 hours left', () => {
			const c = makeCase({ deadline: hoursFromNow(36) });

			expect(deadlineApproachingPredicate(c, params, NOW)).toBe(true);
		});

		it('matches at exactly 0 hours left', () => {
			const c = makeCase({ deadline: hoursFromNow(0) });

			expect(deadlineApproachingPredicate(c, params, NOW)).toBe(true);
		});

		it('does not match at exactly 48 hours left (threshold boundary)', () => {
			const c = makeCase({ deadline: hoursFromNow(48) });

			expect(deadlineApproachingPredicate(c, params, NOW)).toBe(false);
		});

		it('does not match once the deadline has passed', () => {
			const c = makeCase({ deadline: hoursFromNow(-1) });

			expect(deadlineApproachingPredicate(c, params, NOW)).toBe(false);
		});
	});

	describe('deadline_passed', () => {
		it('matches at -1 hour left', () => {
			const c = makeCase({ deadline: hoursFromNow(-1) });

			expect(deadlinePassedPredicate(c, {}, NOW)).toBe(true);
		});

		it('does not match at exactly 0 hours left', () => {
			const c = makeCase({ deadline: hoursFromNow(0) });

			expect(deadlinePassedPredicate(c, {}, NOW)).toBe(false);
		});
	});
});

describe('evaluate', () => {
	const rules: RuleDefinition[] = [
		{
			ruleId: 'R-DOC-INVOICE',
			version: 1,
			enabled: true,
			reason: 'commercial_invoice is required but not completed',
			when: {
				trigger: 'missing_document',
				params: { documentType: DOCUMENT_TYPE.COMMERCIAL_INVOICE },
			},
			task: {
				severity: RISK_LEVEL.CRITICAL,
				title: 'Missing commercial invoice',
				description: 'desc',
				suggestedAction: 'action',
				assignedTeam: 'trade_operations',
			},
		},
		{
			ruleId: 'R-DOC-TRANSPORT',
			version: 1,
			enabled: true,
			reason: 'transport_document is required but not completed',
			when: {
				trigger: 'missing_document',
				params: { documentType: DOCUMENT_TYPE.TRANSPORT_DOCUMENT },
			},
			task: {
				severity: RISK_LEVEL.CRITICAL,
				title: 'Missing transport document',
				description: 'desc',
				suggestedAction: 'action',
				assignedTeam: 'trade_operations',
			},
		},
		{
			ruleId: 'R-DISABLED',
			version: 1,
			enabled: false,
			reason: 'disabled rule should never fire',
			when: {
				trigger: 'missing_document',
				params: { documentType: DOCUMENT_TYPE.TRANSPORT_DOCUMENT },
			},
			task: {
				severity: RISK_LEVEL.LOW,
				title: 'disabled',
				description: 'desc',
				suggestedAction: 'action',
				assignedTeam: 'trade_operations',
			},
		},
	];

	it('is pure and returns a RuleResult for each matching enabled rule', () => {
		const c = makeCase();
		const now = new Date('2026-07-09T00:00:00.000Z');

		const results = evaluate(c, rules, now);

		expect(results.map((r) => r.ruleId)).toEqual(['R-DOC-TRANSPORT']);

		expect(results[0]).toMatchObject({
			ruleId: 'R-DOC-TRANSPORT',
			reason: 'transport_document is required but not completed',
			task: { severity: RISK_LEVEL.CRITICAL },
		});
	});

	it('does not evaluate disabled rules', () => {
		const c = makeCase({ completedDocuments: [] });
		const results = evaluate(c, rules, new Date());

		expect(results.some((r) => r.ruleId === 'R-DISABLED')).toBe(false);
	});
});

describe('computeRiskRollup', () => {
	it('returns the highest severity among active tasks', () => {
		const rollup = computeRiskRollup([
			{ severity: RISK_LEVEL.HIGH, status: TASK_STATUS.OPEN },
			{ severity: RISK_LEVEL.CRITICAL, status: TASK_STATUS.OPEN },
			{ severity: RISK_LEVEL.MEDIUM, status: TASK_STATUS.OPEN },
		]);

		expect(rollup).toEqual({ riskLevel: RISK_LEVEL.CRITICAL, riskRank: SEVERITY_RANK.critical });
	});

	it('ignores completed and cancelled tasks', () => {
		const rollup = computeRiskRollup([
			{ severity: RISK_LEVEL.CRITICAL, status: TASK_STATUS.COMPLETED },
			{ severity: RISK_LEVEL.CRITICAL, status: TASK_STATUS.CANCELLED },
			{ severity: RISK_LEVEL.MEDIUM, status: TASK_STATUS.OPEN },
		]);

		expect(rollup).toEqual({ riskLevel: RISK_LEVEL.MEDIUM, riskRank: SEVERITY_RANK.medium });
	});

	it('falls back to low when no active tasks or escalations', () => {
		const rollup = computeRiskRollup([
			{ severity: RISK_LEVEL.CRITICAL, status: TASK_STATUS.COMPLETED },
		]);

		expect(rollup).toEqual({ riskLevel: RISK_LEVEL.LOW, riskRank: SEVERITY_RANK.low });
	});

	it('falls back to low when given an empty list', () => {
		const rollup = computeRiskRollup([]);

		expect(rollup).toEqual({ riskLevel: RISK_LEVEL.LOW, riskRank: SEVERITY_RANK.low });
	});

	it('an active escalation alone (no tasks) drives the risk level', () => {
		const rollup = computeRiskRollup([
			{ severity: RISK_LEVEL.HIGH, status: ESCALATION_STATUS.ACTIVE },
		]);

		expect(rollup).toEqual({ riskLevel: RISK_LEVEL.HIGH, riskRank: SEVERITY_RANK.high });
	});

	it('an active escalation outranks a lower-severity task', () => {
		const rollup = computeRiskRollup([
			{ severity: RISK_LEVEL.MEDIUM, status: TASK_STATUS.OPEN },
			{ severity: RISK_LEVEL.CRITICAL, status: ESCALATION_STATUS.ACTIVE },
		]);

		expect(rollup).toEqual({ riskLevel: RISK_LEVEL.CRITICAL, riskRank: SEVERITY_RANK.critical });
	});

	it('a resolved escalation does not count', () => {
		const rollup = computeRiskRollup([
			{ severity: RISK_LEVEL.MEDIUM, status: TASK_STATUS.OPEN },
			{ severity: RISK_LEVEL.CRITICAL, status: ESCALATION_STATUS.RESOLVED },
		]);

		expect(rollup).toEqual({ riskLevel: RISK_LEVEL.MEDIUM, riskRank: SEVERITY_RANK.medium });
	});
});
