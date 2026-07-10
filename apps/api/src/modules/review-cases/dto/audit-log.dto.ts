import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class AuditLogDto {
	@ApiProperty()
	@Expose()
	id!: string;

	@ApiProperty()
	@Expose()
	action!: string;

	@ApiPropertyOptional({ enum: ['case', 'task', 'escalation'] })
	@Expose()
	entity_type?: 'case' | 'task' | 'escalation';

	@ApiPropertyOptional()
	@Expose()
	entity_id?: string;

	@ApiProperty()
	@Expose()
	summary!: string;

	@ApiPropertyOptional({ type: 'object', additionalProperties: true })
	@Expose()
	before?: Record<string, unknown>;

	@ApiPropertyOptional({ type: 'object', additionalProperties: true })
	@Expose()
	after?: Record<string, unknown>;

	@ApiProperty()
	@Expose()
	actor!: string;

	@ApiProperty()
	@Expose()
	created_at!: string;
}
