export const TASK_STATUS = {
	OPEN: 'open',
	IN_PROGRESS: 'in_progress',
	BLOCKED: 'blocked',
	COMPLETED: 'completed',
	CANCELLED: 'cancelled',
} as const;

export type TaskStatus = (typeof TASK_STATUS)[keyof typeof TASK_STATUS];
