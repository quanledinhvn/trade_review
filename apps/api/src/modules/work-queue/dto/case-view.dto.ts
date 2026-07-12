import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
import { SEVERITY_LEVEL, type RiskLevel, type Severity } from '../../../domain/severity';
import { TASK_STATUS, type TaskStatus } from '../../../domain/task-status';

@Exclude()
export class WorkQueueTaskViewDto {
	@ApiProperty()
	@Expose()
	id!: string;

	@ApiProperty()
	@Expose()
	title!: string;

	@ApiProperty({ enum: Object.values(SEVERITY_LEVEL) })
	@Expose()
	severity!: Severity;

	@ApiProperty({ enum: Object.values(TASK_STATUS) })
	@Expose()
	status!: TaskStatus;

	@ApiProperty()
	@Expose()
	suggested_action!: string;
}

@Exclude()
export class WorkQueueEscalationViewDto {
	@ApiProperty({ enum: Object.values(SEVERITY_LEVEL) })
	@Expose()
	severity!: Severity;

	@ApiProperty()
	@Expose()
	reason!: string;
}

@Exclude()
export class CaseViewDto {
	@ApiProperty({ example: 'REV-2026-0119' })
	@Expose()
	case_reference!: string;

	@ApiProperty({ example: 'SHP-2026-0119' })
	@Expose()
	shipment_reference!: string;

	@ApiProperty()
	@Expose()
	importer!: string;

	@ApiProperty()
	@Expose()
	status!: string;

	@ApiProperty({ enum: Object.values(SEVERITY_LEVEL) })
	@Expose()
	risk_level!: RiskLevel;

	@ApiProperty()
	@Expose()
	deadline!: string;

	@ApiProperty()
	@Expose()
	time_remaining_hours!: number;

	@ApiProperty({ type: () => [WorkQueueTaskViewDto] })
	@Expose()
	open_tasks!: WorkQueueTaskViewDto[];

	@ApiProperty({ type: () => [WorkQueueEscalationViewDto] })
	@Expose()
	escalations!: WorkQueueEscalationViewDto[];
}
