import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';
import { ReviewCaseListItemDto } from './review-case-list-item.dto';

@Exclude()
export class ReviewCasesResponseDto {
	@ApiProperty()
	@Expose()
	total!: number;

	@ApiProperty({ type: () => [ReviewCaseListItemDto] })
	@Expose()
	@Type(() => ReviewCaseListItemDto)
	items!: ReviewCaseListItemDto[];
}
