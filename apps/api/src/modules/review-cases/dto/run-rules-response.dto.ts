import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';
import { ESCALATION_TYPE, type EscalationType } from '../../../domain/escalation';
import { SEVERITY_LEVEL, type RiskLevel, type Severity } from '../../../domain/severity';

@Exclude()
export class RunRulesTaskResultDto {
	@ApiProperty()
	@Expose()
	id!: string;

	@ApiProperty()
	@Expose()
	title!: string;

	@ApiProperty({ enum: Object.values(SEVERITY_LEVEL) })
	@Expose()
	severity!: Severity;
}

@Exclude()
export class RunRulesEscalationResultDto {
	@ApiProperty()
	@Expose()
	id!: string;

	@ApiProperty({ enum: Object.values(ESCALATION_TYPE) })
	@Expose()
	type!: EscalationType;

	@ApiProperty({ enum: Object.values(SEVERITY_LEVEL) })
	@Expose()
	severity!: Severity;
}

@Exclude()
export class RuleExecutionResultDto {
	@ApiProperty({ example: 'R-DOC-TRANSPORT' })
	@Expose()
	rule_id!: string;

	@ApiProperty({ example: 'transport_document is required but not completed' })
	@Expose()
	trigger_reason!: string;

	@ApiProperty({ nullable: true, type: RunRulesTaskResultDto })
	@Expose()
	@Type(() => RunRulesTaskResultDto)
	task!: RunRulesTaskResultDto | null;

	@ApiProperty({ nullable: true, type: RunRulesEscalationResultDto })
	@Expose()
	@Type(() => RunRulesEscalationResultDto)
	escalation!: RunRulesEscalationResultDto | null;

	@ApiProperty({ enum: Object.values(SEVERITY_LEVEL) })
	@Expose()
	severity!: Severity;

	@ApiProperty()
	@Expose()
	suggested_action!: string;
}

@Exclude()
export class RunRulesResponseDto {
	@ApiProperty({ enum: Object.values(SEVERITY_LEVEL) })
	@Expose()
	risk_level!: RiskLevel;

	@ApiProperty({ type: [RuleExecutionResultDto] })
	@Expose()
	@Type(() => RuleExecutionResultDto)
	results!: RuleExecutionResultDto[];
}
