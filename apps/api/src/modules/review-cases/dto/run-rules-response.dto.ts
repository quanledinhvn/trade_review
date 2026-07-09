import { Exclude, Expose } from 'class-transformer';
import type { RiskLevel } from '../../../domain/severity';

@Exclude()
export class RunRulesResponseDto {
	@Expose()
	risk_level!: RiskLevel;

	@Expose()
	tasks!: number;

	@Expose()
	escalations!: number;
}
