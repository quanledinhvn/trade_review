import { Exclude, Expose, Type } from 'class-transformer';
import { ReviewCaseListItemDto } from './review-case-list-item.dto';

@Exclude()
export class ReviewCasesResponseDto {
	@Expose()
	total!: number;

	@Expose()
	@Type(() => ReviewCaseListItemDto)
	items!: ReviewCaseListItemDto[];
}
