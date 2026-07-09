import { Prisma, type Escalation, type ReviewCase, type Task } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import type { PrismaService } from '../../src/database/prisma.service';
import {
	CASE_STATUS,
	computeRiskRollup,
	ESCALATION_STATUS,
	evaluate,
	loadRulesConfig,
	parseDateOnly,
	SEVERITY_RANK,
	TASK_STATUS,
	type CaseStatus,
	type DocumentType,
	type RuleResult,
} from '../../src/domain';
import type { CreateReviewCaseDto } from '../../src/modules/review-cases/dto/create-review-case.dto';
import { validCreatePayload } from './fixtures';
import type { CreateCaseOptions } from './create-case';

export interface TaskSeedOverride {
	status?: string;
	assignedUser?: string | null;
	resolutionComment?: string | null;
}

export interface EscalationSeedOverride {
	status?: string;
	resolvedAt?: Date | null;
	resolvedReason?: string | null;
}

export interface SeedInReviewCaseOptions extends CreateCaseOptions {
	status?: CaseStatus;
	taskOverrides?: Record<string, TaskSeedOverride>;
	escalationOverrides?: Record<string, EscalationSeedOverride>;
}

export interface SeededInReviewCase extends ReviewCase {
	tasks: Task[];
	escalations: Escalation[];
}

function buildTaskData(reviewCase: ReviewCase, result: RuleResult, override?: TaskSeedOverride) {
	const task = result.task!;

	return {
		id: uuidv7(),
		caseId: reviewCase.id,
		ruleId: result.ruleId,
		title: task.title,
		reason: result.reason,
		description: task.description,
		severity: task.severity,
		severityRank: SEVERITY_RANK[task.severity],
		suggestedAction: task.suggestedAction,
		dueDate: reviewCase.deadline,
		assignedTeam: task.assignedTeam,
		assignedUser: override?.assignedUser ?? null,
		status: override?.status ?? TASK_STATUS.OPEN,
		resolutionComment: override?.resolutionComment ?? null,
		documentType: result.documentType ?? null,
		ruleSnapshot: result.rule as unknown as Prisma.InputJsonValue,
	};
}

function buildEscalationData(
	reviewCase: ReviewCase,
	result: RuleResult,
	override?: EscalationSeedOverride,
) {
	const escalation = result.escalation!;

	return {
		id: uuidv7(),
		caseId: reviewCase.id,
		ruleId: result.ruleId,
		type: escalation.type,
		severity: escalation.severity,
		reason: escalation.reason,
		suggestedAction: escalation.suggestedAction,
		status: override?.status ?? ESCALATION_STATUS.ACTIVE,
		resolvedAt: override?.resolvedAt ?? null,
		resolvedReason: override?.resolvedReason ?? null,
		ruleSnapshot: result.rule as unknown as Prisma.InputJsonValue,
	};
}

export async function seedInReviewCase(
	prisma: PrismaService,
	overrides: Partial<CreateReviewCaseDto> & Record<string, unknown> = {},
	options: SeedInReviewCaseOptions = {},
): Promise<SeededInReviewCase> {
	const dto = { ...validCreatePayload, ...overrides } as CreateReviewCaseDto;
	const now = options.now ?? new Date();
	const arrivalDate = parseDateOnly(dto.arrival_date);

	let deadline: Date;

	if (options.deadline !== undefined) {
		deadline = options.deadline;
	} else if (options.deadlineHoursFromNow !== undefined) {
		deadline = new Date(now.getTime() + options.deadlineHoursFromNow * 60 * 60 * 1000);
	} else {
		deadline = new Date(dto.arrival_date);

		deadline.setDate(deadline.getDate() + dto.review_window_days);
	}

	const caseLike = {
		requiredDocuments: dto.required_documents as DocumentType[],
		completedDocuments: dto.completed_documents as DocumentType[],
		packagingType: dto.packaging_type as never,
		ispm15Certified: dto.ispm15_certified,
		invoiceValue: dto.invoice_value,
		deadline,
	};

	const results = evaluate(caseLike, loadRulesConfig(), now);
	const taskResults = results.filter((result) => result.task);
	const escalationResults = results.filter((result) => result.escalation);

	const taskData = taskResults.map((result) =>
		buildTaskData(
			{ id: '', deadline } as ReviewCase,
			result,
			options.taskOverrides?.[result.ruleId],
		),
	);

	const escalationData = escalationResults.map((result) =>
		buildEscalationData(
			{ id: '', deadline } as ReviewCase,
			result,
			options.escalationOverrides?.[result.ruleId],
		),
	);

	const rollup = computeRiskRollup([
		...taskData.map((task) => ({ severity: task.severity as never, status: task.status })),
		...escalationData.map((escalation) => ({
			severity: escalation.severity as never,
			status: escalation.status,
		})),
	]);

	return prisma.$transaction(async (tx) => {
		const reviewCase = await tx.reviewCase.create({
			data: {
				id: uuidv7(),
				caseReference: dto.case_reference,
				shipmentReference: dto.shipment_reference,
				importer: dto.importer,
				arrivalDate,
				reviewWindowDays: dto.review_window_days,
				deadline,
				status: options.status ?? CASE_STATUS.IN_REVIEW,
				riskLevel: rollup.riskLevel,
				riskRank: rollup.riskRank,
				assignedTeam: dto.assigned_team,
				assignedUser: dto.assigned_user ?? null,
				requiredDocuments: dto.required_documents,
				completedDocuments: dto.completed_documents,
				invoiceValue: new Prisma.Decimal(dto.invoice_value),
				packagingType: dto.packaging_type,
				ispm15Certified: dto.ispm15_certified,
			},
		});

		const tasks: Task[] = [];

		for (const data of taskData) {
			tasks.push(
				await tx.task.create({
					data: { ...data, caseId: reviewCase.id },
				}),
			);
		}

		const escalations: Escalation[] = [];

		for (const data of escalationData) {
			escalations.push(
				await tx.escalation.create({
					data: { ...data, caseId: reviewCase.id },
				}),
			);
		}

		return { ...reviewCase, tasks, escalations };
	});
}
