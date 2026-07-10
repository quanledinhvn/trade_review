import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReassignTaskDto {
	@ApiProperty({ example: 'trade_operations' })
	@IsString()
	@IsNotEmpty()
	assigned_team!: string;

	@ApiPropertyOptional({ example: 'reviewer-1' })
	@IsOptional()
	@IsString()
	assigned_user?: string;
}
