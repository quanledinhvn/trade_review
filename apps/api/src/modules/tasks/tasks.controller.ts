import { Body, Controller, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Actor, ActorContextGuard } from '../../common/auth';
import { ApiActorHeaders, ApiRequestIdHeader } from '../../common/openapi/headers';
import type { ActorContext } from '../../domain';
import { CompleteTaskResponseDto } from './dto/complete-task-response.dto';
import { CompleteTaskDto } from './dto/complete-task.dto';
import { ReassignTaskDto } from './dto/reassign-task.dto';
import { TaskDto } from './dto/task.dto';
import { TasksService } from './tasks.service';

@UseGuards(ActorContextGuard)
@ApiTags('Tasks')
@ApiRequestIdHeader()
@ApiActorHeaders()
@Controller('tasks')
export class TasksController {
	constructor(private readonly tasksService: TasksService) {}

	@Post(':id/complete')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'Complete a review task' })
	@ApiParam({ name: 'id', description: 'Task ID' })
	@ApiOkResponse({ type: CompleteTaskResponseDto })
	complete(
		@Param('id') id: string,
		@Body() dto: CompleteTaskDto,
		@Actor() actor: ActorContext,
	): Promise<CompleteTaskResponseDto> {
		return this.tasksService.complete(id, dto, actor);
	}

	@Post(':id/reassign')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'Reassign a review task' })
	@ApiParam({ name: 'id', description: 'Task ID' })
	@ApiOkResponse({ type: TaskDto })
	reassign(
		@Param('id') id: string,
		@Body() dto: ReassignTaskDto,
		@Actor() actor: ActorContext,
	): Promise<TaskDto> {
		return this.tasksService.reassign(id, dto, actor);
	}
}
