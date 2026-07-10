import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
	WORK_QUEUE_DEADLINE_VALUES,
	WORK_QUEUE_SORT_VALUES,
	type WorkQueueDeadlineFilter,
	type WorkQueueSort,
} from '../work-queue-query';

export class WorkQueueQueryDto {
	@ApiPropertyOptional({ example: 'trade_operations' })
	@IsOptional()
	@IsString()
	assigned_team?: string;

	@ApiPropertyOptional({ example: 'reviewer-1' })
	@IsOptional()
	@IsString()
	assigned_user?: string;

	@ApiPropertyOptional({ enum: WORK_QUEUE_DEADLINE_VALUES, default: 'all' })
	@IsOptional()
	@IsIn(WORK_QUEUE_DEADLINE_VALUES)
	deadline?: WorkQueueDeadlineFilter;

	@ApiPropertyOptional({ enum: WORK_QUEUE_SORT_VALUES, default: 'risk' })
	@IsOptional()
	@IsIn(WORK_QUEUE_SORT_VALUES)
	sort?: WorkQueueSort;

	@ApiPropertyOptional({ minimum: 1, default: 1 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	page?: number;

	@ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	limit?: number;
}
