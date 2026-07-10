import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';
import { CASE_STATUS, type CaseStatus } from '../../../domain/case-status';
import { RISK_LEVEL, type RiskLevel, type Severity } from '../../../domain/severity';

@Exclude()
export class ReviewCaseListEscalationDto {
	@ApiProperty({ enum: Object.values(RISK_LEVEL) })
	@Expose()
	severity!: Severity;

	@ApiProperty()
	@Expose()
	reason!: string;
}

@Exclude()
export class ReviewCaseListItemDto {
	@ApiProperty({ example: 'REV-2026-0119' })
	@Expose()
	case_reference!: string;

	@ApiProperty({ example: 'SHP-2026-0119' })
	@Expose()
	shipment_reference!: string;

	@ApiProperty()
	@Expose()
	importer!: string;

	@ApiProperty({ enum: Object.values(CASE_STATUS) })
	@Expose()
	status!: CaseStatus;

	@ApiProperty({ enum: Object.values(RISK_LEVEL) })
	@Expose()
	risk_level!: RiskLevel;

	@ApiProperty()
	@Expose()
	deadline!: string;

	@ApiProperty()
	@Expose()
	time_remaining_hours!: number;

	@ApiProperty({ type: () => [ReviewCaseListEscalationDto] })
	@Expose()
	@Type(() => ReviewCaseListEscalationDto)
	escalations!: ReviewCaseListEscalationDto[];

	@ApiProperty()
	@Expose()
	assigned_team!: string;

	@ApiProperty({ nullable: true })
	@Expose()
	assigned_user!: string | null;
}
