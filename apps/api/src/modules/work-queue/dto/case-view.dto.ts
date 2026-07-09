import { Exclude, Expose } from 'class-transformer';
import type { RiskLevel, Severity } from '../../../domain/severity';
import type { TaskStatus } from '../../../domain/task-status';

@Exclude()
export class WorkQueueTaskViewDto {
	@Expose()
	id!: string;

	@Expose()
	title!: string;

	@Expose()
	severity!: Severity;

	@Expose()
	status!: TaskStatus;

	@Expose()
	suggested_action!: string;
}

@Exclude()
export class WorkQueueEscalationViewDto {
	@Expose()
	severity!: Severity;

	@Expose()
	reason!: string;
}

@Exclude()
export class CaseViewDto {
	@Expose()
	case_reference!: string;

	@Expose()
	shipment_reference!: string;

	@Expose()
	importer!: string;

	@Expose()
	status!: string;

	@Expose()
	risk_level!: RiskLevel;

	@Expose()
	deadline!: string;

	@Expose()
	time_remaining_hours!: number;

	@Expose()
	open_tasks!: WorkQueueTaskViewDto[];

	@Expose()
	escalations!: WorkQueueEscalationViewDto[];
}
