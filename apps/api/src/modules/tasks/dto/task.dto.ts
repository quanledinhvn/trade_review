import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
import { DOCUMENT_TYPE_VALUES, type DocumentType } from '../../../domain/document-type';
import { RISK_LEVEL, type Severity } from '../../../domain/severity';
import { TASK_STATUS, type TaskStatus } from '../../../domain/task-status';

@Exclude()
export class TaskDto {
	@ApiProperty()
	@Expose()
	id!: string;

	@ApiProperty()
	@Expose()
	case_id!: string;

	@ApiProperty({ example: 'missing_transport_document' })
	@Expose()
	rule_id!: string;

	@ApiProperty()
	@Expose()
	title!: string;

	@ApiProperty()
	@Expose()
	reason!: string;

	@ApiProperty()
	@Expose()
	description!: string;

	@ApiProperty({ enum: Object.values(RISK_LEVEL) })
	@Expose()
	severity!: Severity;

	@ApiProperty()
	@Expose()
	severity_rank!: number;

	@ApiProperty()
	@Expose()
	suggested_action!: string;

	@ApiProperty()
	@Expose()
	due_date!: string;

	@ApiProperty()
	@Expose()
	assigned_team!: string;

	@ApiProperty({ nullable: true })
	@Expose()
	assigned_user!: string | null;

	@ApiProperty({ enum: Object.values(TASK_STATUS) })
	@Expose()
	status!: TaskStatus;

	@ApiProperty({ enum: DOCUMENT_TYPE_VALUES, nullable: true })
	@Expose()
	document_type!: DocumentType | null;

	@ApiProperty({ nullable: true })
	@Expose()
	resolution_comment!: string | null;

	@ApiProperty()
	@Expose()
	created_at!: string;

	@ApiProperty()
	@Expose()
	updated_at!: string;
}
