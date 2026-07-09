import { isCaseReadyToComplete } from './case-status';
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
});
