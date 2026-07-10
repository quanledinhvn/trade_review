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
import {
	ApiCreatedResponse,
	ApiOkResponse,
	ApiOperation,
	ApiParam,
	ApiQuery,
	ApiTags,
} from '@nestjs/swagger';
import { Actor, ActorContextGuard } from '../../common/auth';
import { ApiActorHeaders, ApiRequestIdHeader } from '../../common/openapi/headers';
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

@ApiTags('Review cases')
@ApiRequestIdHeader()
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
	@ApiActorHeaders()
	@ApiOperation({ summary: 'Create a shipment review case' })
	@ApiCreatedResponse({ type: ReviewCaseResponseDto })
	create(
		@Body() dto: CreateReviewCaseDto,
		@Actor() actor: ActorContext,
	): Promise<ReviewCaseResponseDto> {
		return this.reviewCasesService.create(dto, actor);
	}

	@Get()
	@ApiOperation({ summary: 'List review cases' })
	@ApiOkResponse({ type: ReviewCasesResponseDto })
	list(@Query() query: ReviewCasesQueryDto): Promise<ReviewCasesResponseDto> {
		return this.reviewCasesService.list(query);
	}

	@Get(':id')
	@ApiOperation({ summary: 'Get a review case by ID or case reference' })
	@ApiParam({
		name: 'id',
		description: 'Review case ID or case reference',
		example: 'REV-2026-0119',
	})
	@ApiOkResponse({ type: ReviewCaseResponseDto })
	findById(@Param('id') id: string): Promise<ReviewCaseResponseDto> {
		return this.reviewCasesService.findById(id);
	}

	@Get(':id/audit-log')
	@ApiOperation({ summary: 'List audit log entries for a review case' })
	@ApiParam({
		name: 'id',
		description: 'Review case ID or case reference',
		example: 'REV-2026-0119',
	})
	@ApiOkResponse({ type: AuditLogDto, isArray: true })
	listAuditLog(@Param('id') id: string): Promise<AuditLogDto[]> {
		return this.reviewCasesService.listAuditLog(id);
	}

	@Get(':id/tasks')
	@ApiOperation({ summary: 'List tasks for a review case' })
	@ApiParam({
		name: 'id',
		description: 'Review case ID or case reference',
		example: 'REV-2026-0119',
	})
	@ApiQuery({
		name: 'status',
		required: false,
		description: 'Optional task status filter',
	})
	@ApiOkResponse({ type: TaskDto, isArray: true })
	listTasks(@Param('id') id: string, @Query('status') status?: string): Promise<TaskDto[]> {
		return this.tasksService.listByCaseId(id, status);
	}

	@Post(':id/run-rules')
	@HttpCode(HttpStatus.OK)
	@UseGuards(ActorContextGuard)
	@ApiActorHeaders()
	@ApiOperation({ summary: 'Run the rule engine for a review case' })
	@ApiParam({
		name: 'id',
		description: 'Review case ID or case reference',
		example: 'REV-2026-0119',
	})
	@ApiOkResponse({ type: RunRulesResponseDto })
	runRules(@Param('id') id: string, @Actor() actor: ActorContext): Promise<RunRulesResponseDto> {
		return this.ruleEngineService.runRules(id, actor);
	}
}
