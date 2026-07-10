import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';
import { CaseViewDto } from './case-view.dto';

@Exclude()
export class WorkQueueResponseDto {
	@ApiProperty()
	@Expose()
	total!: number;

	@ApiProperty({ type: () => [CaseViewDto] })
	@Expose()
	@Type(() => CaseViewDto)
	items!: CaseViewDto[];
}
