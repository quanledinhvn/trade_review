import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
import { DOCUMENT_TYPE_VALUES, type DocumentType } from '../../../domain/document-type';
import { TASK_STATUS, type TaskStatus } from '../../../domain/task-status';

@Exclude()
export class CompleteTaskResponseDto {
	@ApiProperty()
	@Expose()
	id!: string;

	@ApiProperty({ enum: Object.values(TASK_STATUS) })
	@Expose()
	status!: TaskStatus;

	@ApiProperty({ nullable: true })
	@Expose()
	resolution_comment!: string | null;

	@ApiProperty()
	@Expose()
	updated_at!: string;

	@ApiPropertyOptional({ enum: DOCUMENT_TYPE_VALUES })
	@Expose()
	document_completed?: DocumentType;
}
