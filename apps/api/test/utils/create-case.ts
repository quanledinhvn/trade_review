import { Prisma, type ReviewCase } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import type { PrismaService } from '../../src/database/prisma.service';
import {
	calculateDeadline,
	CASE_STATUS,
	parseDateOnly,
	SEVERITY_LEVEL,
	SEVERITY_RANK,
	type CaseStatus,
	type RiskLevel,
} from '../../src/domain';
import type { CreateReviewCaseDto } from '../../src/modules/review-cases/dto/create-review-case.dto';
import { validCreatePayload } from './fixtures';

export interface CreateCaseOptions {
	deadline?: Date;
	deadlineHoursFromNow?: number;
	now?: Date;
	status?: CaseStatus;
	riskLevel?: RiskLevel;
	riskRank?: number;
}

export async function createCase(
	prisma: PrismaService,
	overrides: Partial<CreateReviewCaseDto> & Record<string, unknown> = {},
	options: CreateCaseOptions = {},
): Promise<ReviewCase> {
	const dto = { ...validCreatePayload, ...overrides } as CreateReviewCaseDto;
	const now = options.now ?? new Date();
	const arrivalDate = parseDateOnly(dto.arrival_date);

	let deadline: Date;

	if (options.deadline !== undefined) {
		deadline = options.deadline;
	} else if (options.deadlineHoursFromNow !== undefined) {
		deadline = new Date(now.getTime() + options.deadlineHoursFromNow * 60 * 60 * 1000);
	} else {
		deadline = calculateDeadline(arrivalDate, dto.review_window_days);
	}

	return prisma.reviewCase.create({
		data: {
			id: uuidv7(),
			caseReference: dto.case_reference,
			shipmentReference: dto.shipment_reference,
			importer: dto.importer,
			arrivalDate,
			reviewWindowDays: dto.review_window_days,
			deadline,
			status: options.status ?? CASE_STATUS.OPEN,
			riskLevel: options.riskLevel ?? SEVERITY_LEVEL.LOW,
			riskRank: options.riskRank ?? SEVERITY_RANK.low,
			assignedTeam: dto.assigned_team,
			assignedUser: dto.assigned_user ?? null,
			requiredDocuments: dto.required_documents,
			completedDocuments: dto.completed_documents,
			invoiceValue: new Prisma.Decimal(dto.invoice_value),
			packagingType: dto.packaging_type,
			ispm15Certified: dto.ispm15_certified,
		},
	});
}
