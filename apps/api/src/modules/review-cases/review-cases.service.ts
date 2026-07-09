import { Injectable } from '@nestjs/common';
import { Prisma, type Escalation, type ReviewCase, type Task } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { v7 as uuidv7 } from 'uuid';
import { AppConflictException, AppNotFoundException } from '../../common/exceptions/exception';
import { PrismaService } from '../../database/prisma.service';
import {
	AUDIT_ACTION,
	calculateDeadline,
	CASE_STATUS,
	computeRiskRollup,
	ESCALATION_STATUS,
	formatDateOnly,
	parseDateOnly,
	RISK_LEVEL,
	SEVERITY_RANK,
	timeRemainingHours,
	type ActorContext,
	type RiskRollup,
	type Severity,
	CaseStatus,
} from '../../domain';
import { AuditService } from '../audit/audit.service';
import type { CreateReviewCaseDto } from './dto/create-review-case.dto';
import { ReviewCaseListItemDto } from './dto/review-case-list-item.dto';
import { ReviewCaseResponseDto } from './dto/review-case-response.dto';
import type { ReviewCasesQueryDto } from './dto/review-cases-query.dto';
import { AuditLogDto } from './dto/audit-log.dto';
import { ReviewCasesResponseDto } from './dto/review-cases-response.dto';

@Injectable()
export class ReviewCasesService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly auditService: AuditService,
	) {}

	async create(dto: CreateReviewCaseDto, actor: ActorContext): Promise<ReviewCaseResponseDto> {
		const arrivalDate = parseDateOnly(dto.arrival_date);
		const deadline = calculateDeadline(arrivalDate, dto.review_window_days);
		const id = uuidv7();

		try {
			const reviewCase = await this.prisma.$transaction(async (tx) => {
				const created = await tx.reviewCase.create({
					data: {
						id,
						caseReference: dto.case_reference,
						shipmentReference: dto.shipment_reference,
						importer: dto.importer,
						arrivalDate,
						reviewWindowDays: dto.review_window_days,
						deadline,
						status: CASE_STATUS.OPEN,
						riskLevel: RISK_LEVEL.LOW,
						riskRank: SEVERITY_RANK.low,
						assignedTeam: dto.assigned_team,
						assignedUser: dto.assigned_user ?? null,
						requiredDocuments: dto.required_documents,
						completedDocuments: dto.completed_documents,
						invoiceValue: new Prisma.Decimal(dto.invoice_value),
						packagingType: dto.packaging_type,
						ispm15Certified: dto.ispm15_certified,
					},
				});

				await this.auditService.auditReviewCase(tx, {
					action: AUDIT_ACTION.CASE_CREATED,
					after: created,
					actor: actor.actorId,
				});

				return created;
			});

			return this.toResponse(reviewCase);
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
				throw new AppConflictException('case_reference already exists', {
					case_reference: dto.case_reference,
				});
			}

			throw error;
		}
	}

	async list(query: ReviewCasesQueryDto): Promise<ReviewCasesResponseDto> {
		const page = query.page ?? 1;
		const limit = query.limit ?? 20;
		const skip = (page - 1) * limit;
		const now = new Date();
		const where: Prisma.ReviewCaseWhereInput = {};

		if (query.status && query.status !== 'all') {
			where.status = query.status;
		}

		const [total, cases] = await Promise.all([
			this.prisma.reviewCase.count({ where }),
			this.prisma.reviewCase.findMany({
				where,
				skip,
				take: limit,
				orderBy: { updatedAt: 'desc' },
				include: {
					escalations: {
						where: { status: ESCALATION_STATUS.ACTIVE },
					},
				},
			}),
		]);

		const items = cases.map((reviewCase) =>
			plainToInstance(ReviewCaseListItemDto, {
				case_reference: reviewCase.caseReference,
				shipment_reference: reviewCase.shipmentReference,
				importer: reviewCase.importer,
				status: reviewCase.status,
				risk_level: reviewCase.riskLevel,
				deadline: formatDateOnly(reviewCase.deadline),
				time_remaining_hours: timeRemainingHours(reviewCase.deadline, now),
				escalations: reviewCase.escalations.map((escalation) => ({
					severity: escalation.severity,
					reason: escalation.reason,
				})),
				assigned_team: reviewCase.assignedTeam,
				assigned_user: reviewCase.assignedUser,
			}),
		);

		return plainToInstance(ReviewCasesResponseDto, { total, items });
	}

	async resolveReviewCase(idOrRef: string): Promise<ReviewCase> {
		const reviewCase = await this.prisma.reviewCase.findFirst({
			where: {
				OR: [{ id: idOrRef }, { caseReference: idOrRef }],
			},
		});

		if (!reviewCase) {
			throw new AppNotFoundException('Review case not found');
		}

		return reviewCase;
	}

	async listAuditLog(idOrRef: string): Promise<AuditLogDto[]> {
		const reviewCase = await this.prisma.reviewCase.findFirst({
			where: {
				OR: [{ id: idOrRef }, { caseReference: idOrRef }],
			},
			select: { id: true },
		});

		if (!reviewCase) {
			throw new AppNotFoundException('Review case not found');
		}

		const logs = await this.prisma.auditLog.findMany({
			where: { caseId: reviewCase.id },
			orderBy: { createdAt: 'asc' },
		});

		return logs.map((log) =>
			plainToInstance(AuditLogDto, {
				id: log.id,
				action: log.action,
				entity_type: log.entityType ?? undefined,
				entity_id: log.entityId ?? undefined,
				summary: log.summary,
				before: log.before ?? undefined,
				after: log.after ?? undefined,
				actor: log.actor,
				created_at: log.createdAt.toISOString(),
			}),
		);
	}

	async findById(idOrRef: string): Promise<ReviewCaseResponseDto> {
		const reviewCase = await this.prisma.reviewCase.findFirst({
			where: {
				OR: [{ id: idOrRef }, { caseReference: idOrRef }],
			},
			include: { escalations: true },
		});

		if (!reviewCase) {
			throw new AppNotFoundException('Review case not found');
		}

		return this.toResponse(reviewCase, reviewCase.escalations);
	}

	async syncCaseRiskRollup(
		tx: Prisma.TransactionClient,
		caseId: string,
		tasks: Task[],
		escalations: Escalation[],
		data?: { status: CaseStatus },
	): Promise<RiskRollup> {
		const rollup = computeRiskRollup([
			...tasks.map((task) => ({
				severity: task.severity as Severity,
				status: task.status,
			})),
			...escalations.map((escalation) => ({
				severity: escalation.severity as Severity,
				status: escalation.status,
			})),
		]);

		await tx.reviewCase.update({
			where: { id: caseId },
			data: {
				...data,
				riskLevel: rollup.riskLevel,
				riskRank: rollup.riskRank,
			},
		});

		return rollup;
	}

	private toResponse(
		reviewCase: ReviewCase,
		escalations: Escalation[] = [],
	): ReviewCaseResponseDto {
		return plainToInstance(ReviewCaseResponseDto, {
			id: reviewCase.id,
			case_reference: reviewCase.caseReference,
			shipment_reference: reviewCase.shipmentReference,
			importer: reviewCase.importer,
			arrival_date: formatDateOnly(reviewCase.arrivalDate),
			review_window_days: reviewCase.reviewWindowDays,
			deadline: formatDateOnly(reviewCase.deadline),
			status: reviewCase.status,
			risk_level: reviewCase.riskLevel,
			risk_rank: reviewCase.riskRank,
			invoice_value: reviewCase.invoiceValue.toNumber(),
			packaging_type: reviewCase.packagingType,
			ispm15_certified: reviewCase.ispm15Certified,
			required_documents: reviewCase.requiredDocuments,
			completed_documents: reviewCase.completedDocuments,
			assigned_team: reviewCase.assignedTeam,
			assigned_user: reviewCase.assignedUser,
			created_at: reviewCase.createdAt.toISOString(),
			updated_at: reviewCase.updatedAt.toISOString(),
			time_remaining_hours: timeRemainingHours(reviewCase.deadline),
			escalations: escalations.map((e) => ({
				id: e.id,
				rule_id: e.ruleId,
				type: e.type,
				severity: e.severity,
				reason: e.reason,
				suggested_action: e.suggestedAction,
				status: e.status,
				resolved_reason: e.resolvedReason,
				created_at: e.createdAt.toISOString(),
			})),
		});
	}
}
