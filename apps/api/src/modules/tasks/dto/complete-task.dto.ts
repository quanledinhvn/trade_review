import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CompleteTaskDto {
	@ApiPropertyOptional({ example: 'Transport document uploaded and verified.' })
	@IsOptional()
	@IsString()
	resolution_comment?: string;
}
