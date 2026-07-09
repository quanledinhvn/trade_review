import { Exclude, Expose, Type } from 'class-transformer';
import { CaseViewDto } from './case-view.dto';

@Exclude()
export class WorkQueueResponseDto {
	@Expose()
	total!: number;

	@Expose()
	@Type(() => CaseViewDto)
	items!: CaseViewDto[];
}
