import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
import { RISK_LEVEL, type RiskLevel } from '../../../domain/severity';

@Exclude()
export class RunRulesResponseDto {
	@ApiProperty({ enum: Object.values(RISK_LEVEL) })
	@Expose()
	risk_level!: RiskLevel;

	@ApiProperty()
	@Expose()
	tasks!: number;

	@ApiProperty()
	@Expose()
	escalations!: number;
}
