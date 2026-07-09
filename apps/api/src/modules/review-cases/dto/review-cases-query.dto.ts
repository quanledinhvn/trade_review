import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
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
	@IsOptional()
	@IsIn(REVIEW_CASES_STATUS_FILTER_VALUES)
	status?: ReviewCasesStatusFilter;

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
