import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CASE_STATUS } from '../../../domain/case-status';

export const REVIEW_CASES_STATUS_FILTER_VALUES = [
	'all',
	CASE_STATUS.OPEN,
	CASE_STATUS.IN_REVIEW,
	CASE_STATUS.COMPLETED,
	'cancelled',
] as const;

export type ReviewCasesStatusFilter = (typeof REVIEW_CASES_STATUS_FILTER_VALUES)[number];

export class ReviewCasesQueryDto {
	@ApiPropertyOptional({ enum: REVIEW_CASES_STATUS_FILTER_VALUES, default: 'all' })
	@IsOptional()
	@IsIn(REVIEW_CASES_STATUS_FILTER_VALUES)
	status?: ReviewCasesStatusFilter;

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
