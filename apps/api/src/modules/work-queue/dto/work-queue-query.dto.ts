import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import {
	WORK_QUEUE_DEADLINE_VALUES,
	WORK_QUEUE_SORT_VALUES,
	type WorkQueueDeadlineFilter,
	type WorkQueueSort,
} from '../work-queue-query';

export class WorkQueueQueryDto {
	@IsOptional()
	@IsString()
	assigned_team?: string;

	@IsOptional()
	@IsString()
	assigned_user?: string;

	@IsOptional()
	@IsIn(WORK_QUEUE_DEADLINE_VALUES)
	deadline?: WorkQueueDeadlineFilter;

	@IsOptional()
	@IsIn(WORK_QUEUE_SORT_VALUES)
	sort?: WorkQueueSort;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	page?: number;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	limit?: number;
}
