import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';
import { CASE_STATUS, type CaseStatus } from '../../../domain/case-status';
import { DOCUMENT_TYPE_VALUES, type DocumentType } from '../../../domain/document-type';
import {
	ESCALATION_STATUS,
	ESCALATION_TYPE,
	type EscalationStatus,
	type EscalationType,
} from '../../../domain/escalation';
import { PACKAGING_TYPE_VALUES, type PackagingType } from '../../../domain/packaging';
import { RISK_LEVEL, type RiskLevel, type Severity } from '../../../domain/severity';

@Exclude()
export class EscalationDto {
	@ApiProperty()
	@Expose()
	id!: string;

	@ApiProperty({ example: 'deadline_approaching' })
	@Expose()
	rule_id!: string;

	@ApiProperty({ enum: Object.values(ESCALATION_TYPE) })
	@Expose()
	type!: EscalationType;

	@ApiProperty({ enum: Object.values(RISK_LEVEL) })
	@Expose()
	severity!: Severity;

	@ApiProperty()
	@Expose()
	reason!: string;

	@ApiProperty()
	@Expose()
	suggested_action!: string;

	@ApiProperty({ enum: Object.values(ESCALATION_STATUS) })
	@Expose()
	status!: EscalationStatus;

	@ApiProperty({ nullable: true })
	@Expose()
	resolved_reason!: string | null;

	@ApiProperty()
	@Expose()
	created_at!: string;
}

@Exclude()
export class ReviewCaseResponseDto {
	@ApiProperty()
	@Expose()
	id!: string;

	@ApiProperty({ example: 'REV-2026-0119' })
	@Expose()
	case_reference!: string;

	@ApiProperty({ example: 'SHP-2026-0119' })
	@Expose()
	shipment_reference!: string;

	@ApiProperty()
	@Expose()
	importer!: string;

	@ApiProperty({ example: '2026-01-19' })
	@Expose()
	arrival_date!: string;

	@ApiProperty()
	@Expose()
	review_window_days!: number;

	@ApiProperty()
	@Expose()
	deadline!: string;

	@ApiProperty({ enum: Object.values(CASE_STATUS) })
	@Expose()
	status!: CaseStatus;

	@ApiProperty({ enum: Object.values(RISK_LEVEL) })
	@Expose()
	risk_level!: RiskLevel;

	@ApiProperty()
	@Expose()
	risk_rank!: number;

	@ApiProperty()
	@Expose()
	invoice_value!: number;

	@ApiProperty({ enum: PACKAGING_TYPE_VALUES, nullable: true })
	@Expose()
	packaging_type!: PackagingType | null;

	@ApiProperty({ nullable: true })
	@Expose()
	ispm15_certified!: boolean | null;

	@ApiProperty({ enum: DOCUMENT_TYPE_VALUES, isArray: true })
	@Expose()
	required_documents!: DocumentType[];

	@ApiProperty({ enum: DOCUMENT_TYPE_VALUES, isArray: true })
	@Expose()
	completed_documents!: DocumentType[];

	@ApiProperty()
	@Expose()
	assigned_team!: string;

	@ApiProperty({ nullable: true })
	@Expose()
	assigned_user!: string | null;

	@ApiProperty()
	@Expose()
	created_at!: string;

	@ApiProperty()
	@Expose()
	updated_at!: string;

	@ApiProperty()
	@Expose()
	time_remaining_hours!: number;

	@ApiProperty({ type: () => [EscalationDto] })
	@Expose()
	@Type(() => EscalationDto)
	escalations!: EscalationDto[];
}
