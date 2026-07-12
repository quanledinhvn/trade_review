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
