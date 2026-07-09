import { Exclude, Expose } from 'class-transformer';
import type { TaskStatus } from '../../../domain/task-status';
import type { DocumentType } from '../../../domain/types';

@Exclude()
export class CompleteTaskResponseDto {
	@Expose()
	id!: string;

	@Expose()
	status!: TaskStatus;

	@Expose()
	resolution_comment!: string | null;

	@Expose()
	updated_at!: string;

	@Expose()
	document_completed?: DocumentType;
}
