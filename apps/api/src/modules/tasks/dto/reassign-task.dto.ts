import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ReassignTaskDto {
	@IsString()
	@IsNotEmpty()
	assigned_team!: string;

	@IsOptional()
	@IsString()
	assigned_user?: string;
}
