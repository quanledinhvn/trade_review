import { Exclude, Expose } from 'class-transformer';
import type { Severity } from '../../../domain/severity';
import type { TaskStatus } from '../../../domain/task-status';
import type { DocumentType } from '../../../domain/document-type';

@Exclude()
export class TaskDto {
	@Expose()
	id!: string;

	@Expose()
	case_id!: string;

	@Expose()
	rule_id!: string;

	@Expose()
	title!: string;

	@Expose()
	reason!: string;

	@Expose()
	description!: string;

	@Expose()
	severity!: Severity;

	@Expose()
	severity_rank!: number;

	@Expose()
	suggested_action!: string;

	@Expose()
	due_date!: string;

	@Expose()
	assigned_team!: string;

	@Expose()
	assigned_user!: string | null;

	@Expose()
	status!: TaskStatus;

	@Expose()
	document_type!: DocumentType | null;

	@Expose()
	resolution_comment!: string | null;

	@Expose()
	created_at!: string;

	@Expose()
	updated_at!: string;
}
