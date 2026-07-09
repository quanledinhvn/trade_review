import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class AuditLogDto {
	@Expose()
	id!: string;

	@Expose()
	action!: string;

	@Expose()
	entity_type?: 'case' | 'task' | 'escalation';

	@Expose()
	entity_id?: string;

	@Expose()
	summary!: string;

	@Expose()
	before?: Record<string, unknown>;

	@Expose()
	after?: Record<string, unknown>;

	@Expose()
	actor!: string;

	@Expose()
	created_at!: string;
}
