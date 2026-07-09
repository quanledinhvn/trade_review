import { Controller, Get, Query } from '@nestjs/common';
import { WorkQueueQueryDto } from './dto/work-queue-query.dto';
import { WorkQueueService } from './work-queue.service';

@Controller('work-queue')
export class WorkQueueController {
	constructor(private readonly workQueueService: WorkQueueService) {}

	@Get()
	getWorkQueue(@Query() query: WorkQueueQueryDto) {
		return this.workQueueService.getWorkQueue(query);
	}
}
