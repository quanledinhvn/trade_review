import { ESCALATION_STATUS } from './escalation';
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

export function hasActiveWork(
	tasks: ReadonlyArray<{ status: string }>,
	escalations: ReadonlyArray<{ status: string }>,
): boolean {
	const hasActiveTasks = tasks.some((task) => !isTerminalTaskStatus(task.status));
	const hasActiveEscalations = escalations.some(
		(escalation) => escalation.status === ESCALATION_STATUS.ACTIVE,
	);

	return hasActiveTasks || hasActiveEscalations;
}

export function resolveCaseStatusAfterRules(
	tasks: ReadonlyArray<{ status: string }>,
	escalations: ReadonlyArray<{ status: string }>,
): CaseStatus {
	return hasActiveWork(tasks, escalations) ? CASE_STATUS.IN_REVIEW : CASE_STATUS.COMPLETED;
}

export function isCaseReadyToComplete(tasks: ReadonlyArray<{ status: string }>): boolean {
	return tasks.length > 0 && tasks.every((task) => isTerminalTaskStatus(task.status));
}
