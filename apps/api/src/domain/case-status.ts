import { TASK_STATUS } from './task-status';

export const CASE_STATUS = {
	OPEN: 'open',
	IN_REVIEW: 'in_review',
	COMPLETED: 'completed',
} as const;

export type CaseStatus = (typeof CASE_STATUS)[keyof typeof CASE_STATUS];

export function isTerminalTaskStatus(status: string): boolean {
	return status === TASK_STATUS.COMPLETED || status === TASK_STATUS.CANCELLED;
}

export function isCaseReadyToComplete(tasks: ReadonlyArray<{ status: string }>): boolean {
	return tasks.length > 0 && tasks.every((task) => isTerminalTaskStatus(task.status));
}
