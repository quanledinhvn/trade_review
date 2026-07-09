import { Body, Controller, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { Actor, ActorContextGuard } from '../../common/auth';
import type { ActorContext } from '../../domain';
import { CompleteTaskResponseDto } from './dto/complete-task-response.dto';
import { CompleteTaskDto } from './dto/complete-task.dto';
import { ReassignTaskDto } from './dto/reassign-task.dto';
import { TaskDto } from './dto/task.dto';
import { TasksService } from './tasks.service';

@UseGuards(ActorContextGuard)
@Controller('tasks')
export class TasksController {
	constructor(private readonly tasksService: TasksService) {}

	@Post(':id/complete')
	@HttpCode(HttpStatus.OK)
	complete(
		@Param('id') id: string,
		@Body() dto: CompleteTaskDto,
		@Actor() actor: ActorContext,
	): Promise<CompleteTaskResponseDto> {
		return this.tasksService.complete(id, dto, actor);
	}

	@Post(':id/reassign')
	@HttpCode(HttpStatus.OK)
	reassign(
		@Param('id') id: string,
		@Body() dto: ReassignTaskDto,
		@Actor() actor: ActorContext,
	): Promise<TaskDto> {
		return this.tasksService.reassign(id, dto, actor);
	}
}
