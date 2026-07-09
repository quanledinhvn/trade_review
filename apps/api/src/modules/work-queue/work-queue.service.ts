import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { PrismaService } from '../../database/prisma.service';
import { formatDateOnly, timeRemainingHours } from '../../domain';
import { CaseViewDto } from './dto/case-view.dto';
import type { WorkQueueQueryDto } from './dto/work-queue-query.dto';
import { WorkQueueResponseDto } from './dto/work-queue-response.dto';
import { WorkQueueQueryBuilder } from './work-queue.query-builder';

@Injectable()
export class WorkQueueService {
	constructor(private readonly prisma: PrismaService) {}

	async getWorkQueue(query: WorkQueueQueryDto): Promise<WorkQueueResponseDto> {
		const now = new Date();
		const findArgs = WorkQueueQueryBuilder.from(query, now).build();

		const [total, cases] = await Promise.all([
			this.prisma.reviewCase.count({ where: findArgs.where }),
			this.prisma.reviewCase.findMany(findArgs),
		]);

		const items = cases.map((reviewCase) =>
			plainToInstance(CaseViewDto, {
				case_reference: reviewCase.caseReference,
				shipment_reference: reviewCase.shipmentReference,
				importer: reviewCase.importer,
				status: reviewCase.status,
				risk_level: reviewCase.riskLevel,
				deadline: formatDateOnly(reviewCase.deadline),
				time_remaining_hours: timeRemainingHours(reviewCase.deadline, now),
				open_tasks: reviewCase.tasks.map((task) => ({
					id: task.id,
					title: task.title,
					severity: task.severity,
					status: task.status,
					suggested_action: task.suggestedAction,
				})),
				escalations: reviewCase.escalations.map((escalation) => ({
					severity: escalation.severity,
					reason: escalation.reason,
				})),
			}),
		);

		return plainToInstance(WorkQueueResponseDto, { total, items });
	}
}
