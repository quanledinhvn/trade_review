import { Exclude, Expose, Type } from 'class-transformer';
import type { CaseStatus } from '../../../domain/case-status';
import type { RiskLevel, Severity } from '../../../domain/severity';
import type {
	DocumentType,
	EscalationStatus,
	EscalationType,
	PackagingType,
} from '../../../domain/types';

@Exclude()
export class EscalationDto {
	@Expose()
	id!: string;

	@Expose()
	rule_id!: string;

	@Expose()
	type!: EscalationType;

	@Expose()
	severity!: Severity;

	@Expose()
	reason!: string;

	@Expose()
	suggested_action!: string;

	@Expose()
	status!: EscalationStatus;

	@Expose()
	resolved_reason!: string | null;

	@Expose()
	created_at!: string;
}

@Exclude()
export class ReviewCaseResponseDto {
	@Expose()
	id!: string;

	@Expose()
	case_reference!: string;

	@Expose()
	shipment_reference!: string;

	@Expose()
	importer!: string;

	@Expose()
	arrival_date!: string;

	@Expose()
	review_window_days!: number;

	@Expose()
	deadline!: string;

	@Expose()
	status!: CaseStatus;

	@Expose()
	risk_level!: RiskLevel;

	@Expose()
	risk_rank!: number;

	@Expose()
	invoice_value!: number;

	@Expose()
	packaging_type!: PackagingType | null;

	@Expose()
	ispm15_certified!: boolean | null;

	@Expose()
	required_documents!: DocumentType[];

	@Expose()
	completed_documents!: DocumentType[];

	@Expose()
	assigned_team!: string;

	@Expose()
	assigned_user!: string | null;

	@Expose()
	created_at!: string;

	@Expose()
	updated_at!: string;

	@Expose()
	time_remaining_hours!: number;

	@Expose()
	@Type(() => EscalationDto)
	escalations!: EscalationDto[];
}
