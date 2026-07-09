export const WORK_QUEUE_DEADLINE = {
	ALL: 'all',
	APPROACHING: 'approaching',
	PAST: 'past',
} as const;

export type WorkQueueDeadlineFilter =
	(typeof WORK_QUEUE_DEADLINE)[keyof typeof WORK_QUEUE_DEADLINE];

export const WORK_QUEUE_DEADLINE_VALUES = Object.values(
	WORK_QUEUE_DEADLINE,
) as WorkQueueDeadlineFilter[];

export type WorkQueueActiveDeadlineFilter = Exclude<
	WorkQueueDeadlineFilter,
	typeof WORK_QUEUE_DEADLINE.ALL
>;

export const WORK_QUEUE_SORT = {
	RISK: 'risk',
	DEADLINE: 'deadline',
} as const;

export type WorkQueueSort = (typeof WORK_QUEUE_SORT)[keyof typeof WORK_QUEUE_SORT];

export const WORK_QUEUE_SORT_VALUES = Object.values(WORK_QUEUE_SORT) as WorkQueueSort[];
