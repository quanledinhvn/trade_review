import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Query,
	UseGuards,
} from '@nestjs/common';
import { Actor, ActorContextGuard } from '../../common/auth';
import type { ActorContext } from '../../domain';
import { TaskDto } from '../tasks/dto/task.dto';
import { TasksService } from '../tasks/tasks.service';
import { AuditLogDto } from './dto/audit-log.dto';
import { CreateReviewCaseDto } from './dto/create-review-case.dto';
import { ReviewCaseResponseDto } from './dto/review-case-response.dto';
import { ReviewCasesQueryDto } from './dto/review-cases-query.dto';
import { ReviewCasesResponseDto } from './dto/review-cases-response.dto';
import { RunRulesResponseDto } from './dto/run-rules-response.dto';
import { ReviewCasesService } from './review-cases.service';
import { RuleEngineService } from './rule-engine.service';

@Controller('review-cases')
export class ReviewCasesController {
	constructor(
		private readonly reviewCasesService: ReviewCasesService,
		private readonly ruleEngineService: RuleEngineService,
		private readonly tasksService: TasksService,
	) {}

	@Post()
	@HttpCode(HttpStatus.CREATED)
	@UseGuards(ActorContextGuard)
	create(
		@Body() dto: CreateReviewCaseDto,
		@Actor() actor: ActorContext,
	): Promise<ReviewCaseResponseDto> {
		return this.reviewCasesService.create(dto, actor);
	}

	@Get()
	list(@Query() query: ReviewCasesQueryDto): Promise<ReviewCasesResponseDto> {
		return this.reviewCasesService.list(query);
	}

	@Get(':id')
	findById(@Param('id') id: string): Promise<ReviewCaseResponseDto> {
		return this.reviewCasesService.findById(id);
	}

	@Get(':id/audit-log')
	listAuditLog(@Param('id') id: string): Promise<AuditLogDto[]> {
		return this.reviewCasesService.listAuditLog(id);
	}

	@Get(':id/tasks')
	listTasks(@Param('id') id: string, @Query('status') status?: string): Promise<TaskDto[]> {
		return this.tasksService.listByCaseId(id, status);
	}

	@Post(':id/run-rules')
	@HttpCode(HttpStatus.OK)
	@UseGuards(ActorContextGuard)
	runRules(@Param('id') id: string, @Actor() actor: ActorContext): Promise<RunRulesResponseDto> {
		return this.ruleEngineService.runRules(id, actor);
	}
}
