import { ESCALATION_STATUS } from './escalation';
import { CASE_STATUS, isCaseReadyToComplete, resolveCaseStatusAfterRules } from './case-status';
import { TASK_STATUS } from './task-status';

describe('case-status', () => {
	it('isCaseReadyToComplete is false with no tasks', () => {
		expect(isCaseReadyToComplete([])).toBe(false);
	});

	it('isCaseReadyToComplete is false when any task is still open', () => {
		expect(
			isCaseReadyToComplete([{ status: TASK_STATUS.COMPLETED }, { status: TASK_STATUS.OPEN }]),
		).toBe(false);
	});

	it('isCaseReadyToComplete is true when every task is terminal', () => {
		expect(
			isCaseReadyToComplete([{ status: TASK_STATUS.COMPLETED }, { status: TASK_STATUS.CANCELLED }]),
		).toBe(true);
	});

	it('resolveCaseStatusAfterRules returns completed when there is no active work', () => {
		expect(resolveCaseStatusAfterRules([], [])).toBe(CASE_STATUS.COMPLETED);

		expect(
			resolveCaseStatusAfterRules(
				[{ status: TASK_STATUS.COMPLETED }],
				[{ status: ESCALATION_STATUS.RESOLVED }],
			),
		).toBe(CASE_STATUS.COMPLETED);
	});

	it('resolveCaseStatusAfterRules returns in_review when any task or escalation is active', () => {
		expect(resolveCaseStatusAfterRules([{ status: TASK_STATUS.OPEN }], [])).toBe(
			CASE_STATUS.IN_REVIEW,
		);

		expect(
			resolveCaseStatusAfterRules(
				[{ status: TASK_STATUS.COMPLETED }],
				[{ status: ESCALATION_STATUS.ACTIVE }],
			),
		).toBe(CASE_STATUS.IN_REVIEW);
	});
});
