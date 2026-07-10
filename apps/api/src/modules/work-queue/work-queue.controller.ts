import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiRequestIdHeader } from '../../common/openapi/headers';
import { WorkQueueQueryDto } from './dto/work-queue-query.dto';
import { WorkQueueResponseDto } from './dto/work-queue-response.dto';
import { WorkQueueService } from './work-queue.service';

@ApiTags('Work queue')
@ApiRequestIdHeader()
@Controller('work-queue')
export class WorkQueueController {
	constructor(private readonly workQueueService: WorkQueueService) {}

	@Get()
	@ApiOperation({ summary: 'List in-review cases for the work queue' })
	@ApiOkResponse({ type: WorkQueueResponseDto })
	getWorkQueue(@Query() query: WorkQueueQueryDto): Promise<WorkQueueResponseDto> {
		return this.workQueueService.getWorkQueue(query);
	}
}
