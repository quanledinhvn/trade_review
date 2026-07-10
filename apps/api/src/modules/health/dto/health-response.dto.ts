import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class HealthResponseDto {
	@ApiProperty({ example: 'ok' })
	@Expose()
	status!: string;

	@ApiProperty()
	@Expose()
	uptimeSeconds!: number;

	@ApiProperty()
	@Expose()
	timestamp!: string;
}
