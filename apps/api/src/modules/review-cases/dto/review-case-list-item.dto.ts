import { Exclude, Expose } from 'class-transformer';
import type { CaseStatus } from '../../../domain/case-status';
import type { RiskLevel, Severity } from '../../../domain/severity';

@Exclude()
export class ReviewCaseListEscalationDto {
	@Expose()
	severity!: Severity;

	@Expose()
	reason!: string;
}

@Exclude()
export class ReviewCaseListItemDto {
	@Expose()
	case_reference!: string;

	@Expose()
	shipment_reference!: string;

	@Expose()
	importer!: string;

	@Expose()
	status!: CaseStatus;

	@Expose()
	risk_level!: RiskLevel;

	@Expose()
	deadline!: string;

	@Expose()
	time_remaining_hours!: number;

	@Expose()
	escalations!: ReviewCaseListEscalationDto[];

	@Expose()
	assigned_team!: string;

	@Expose()
	assigned_user!: string | null;
}
