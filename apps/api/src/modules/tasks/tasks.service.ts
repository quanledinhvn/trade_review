import { Injectable } from '@nestjs/common';
import { type ReviewCase, type Task } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { AppConflictException, AppNotFoundException } from '../../common/exceptions/exception';
import { PrismaService } from '../../database/prisma.service';
import {
	assertActorOnAssignedTeam,
	AUDIT_ACTION,
	CASE_STATUS,
	computeRiskRollup,
	ESCALATION_STATUS,
	formatDateOnly,
	RESOLVED_REASON,
	RiskRollupItem,
	TASK_STATUS,
	type ActorContext,
	type DocumentType,
} from '../../domain';
import { AuditService, type AuditLogEntry } from '../audit/audit.service';
import { ReviewCasesService } from '../review-cases/review-cases.service';
import { CompleteTaskResponseDto } from './dto/complete-task-response.dto';
import type { CompleteTaskDto } from './dto/complete-task.dto';
import type { ReassignTaskDto } from './dto/reassign-task.dto';
import { TaskDto } from './dto/task.dto';
import { pickFieldsFrom } from '../../common/utils/pick-fields-from';

type TaskWithCase = Task & { case: ReviewCase };

@Injectable()
export class TasksService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly reviewCasesService: ReviewCasesService,
		private readonly auditService: AuditService,
	) {}

	async listByCaseId(idOrRef: string, status?: string): Promise<TaskDto[]> {
		const reviewCase = await this.reviewCasesService.resolveReviewCase(idOrRef);

		const tasks = await this.prisma.task.findMany({
			where: {
				caseId: reviewCase.id,
				...(status ? { status } : {}),
			},
			orderBy: [{ severityRank: 'desc' }, { dueDate: 'asc' }],
		});

		return tasks.map((task) => this.toTaskDto(task));
	}

	async complete(
		taskId: string,
		dto: CompleteTaskDto,
		actor: ActorContext,
	): Promise<CompleteTaskResponseDto> {
		const task = await this.prisma.task.findUnique({
			where: { id: taskId },
			include: { case: true },
		});

		if (!task) {
			throw new AppNotFoundException('Task not found');
		}

		if (task.status === TASK_STATUS.COMPLETED || task.status === TASK_STATUS.CANCELLED) {
			throw new AppConflictException('Task is already terminal', { status: task.status });
		}

		assertActorOnAssignedTeam(actor, task.assignedTeam, task.assignedUser);

		const now = new Date();

		const { completedTask, documentCompleted } = await this.prisma.$transaction(async (tx) => {
			const completedTask = await tx.task.update({
				where: { id: task.id },
				data: {
					status: TASK_STATUS.COMPLETED,
					resolutionComment: dto.resolution_comment ?? null,
				},
			});

			const documentCompleted = (task.documentType as DocumentType) ?? null;

			if (documentCompleted) {
				await tx.reviewCase.update({
					where: { id: task.caseId },
					data: { completedDocuments: { push: documentCompleted } },
				});
			}

			const [activeTasks, activeEscalations] = await Promise.all([
				tx.task.findMany({
					where: {
						caseId: task.caseId,
						status: { notIn: [TASK_STATUS.COMPLETED, TASK_STATUS.CANCELLED] },
					},
				}),
				tx.escalation.findMany({
					where: { caseId: task.caseId, status: ESCALATION_STATUS.ACTIVE },
				}),
			]);

			const isCaseComplete = activeTasks.length === 0;
			const resolveEscalationIds = isCaseComplete
				? activeEscalations.map((escalation) => escalation.id)
				: [];

			const riskRollup = computeRiskRollup([
				...(activeTasks as RiskRollupItem[]),
				...(isCaseComplete ? [] : (activeEscalations as RiskRollupItem[])),
			]);

			if (resolveEscalationIds.length > 0) {
				await tx.escalation.updateMany({
					where: { id: { in: resolveEscalationIds } },
					data: {
						status: ESCALATION_STATUS.RESOLVED,
						resolvedAt: now,
						resolvedReason: RESOLVED_REASON.CASE_COMPLETED,
					},
				});
			}

			const reviewCaseUpdateData: Partial<ReviewCase> = {};

			if (isCaseComplete && task.case.status !== CASE_STATUS.COMPLETED) {
				reviewCaseUpdateData.status = CASE_STATUS.COMPLETED;
			}

			if (riskRollup.riskRank !== task.case.riskRank) {
				reviewCaseUpdateData.riskRank = riskRollup.riskRank;

				reviewCaseUpdateData.riskLevel = riskRollup.riskLevel;
			}

			if (Object.keys(reviewCaseUpdateData).length > 0) {
				await tx.reviewCase.update({
					where: { id: task.caseId },
					data: reviewCaseUpdateData,
				});
			}

			await this.auditService.auditMany(
				tx,
				this.buildCompletionAudits(task, {
					completedTask,
					documentCompleted,
					resolvedEscalations: activeEscalations.filter((escalation) =>
						resolveEscalationIds.includes(escalation.id),
					),
					reviewCaseUpdateData,
					actorId: actor.actorId,
				}),
			);

			return { completedTask, documentCompleted };
		});

		return plainToInstance(CompleteTaskResponseDto, {
			id: completedTask.id,
			status: completedTask.status,
			resolution_comment: completedTask.resolutionComment,
			updated_at: completedTask.updatedAt.toISOString(),
			document_completed: documentCompleted ?? undefined,
		});
	}

	private buildCompletionAudits(
		task: TaskWithCase,
		context: {
			completedTask: Task;
			documentCompleted: DocumentType | null;
			resolvedEscalations: Array<{ id: string; caseId: string; ruleId: string }>;
			reviewCaseUpdateData: Partial<ReviewCase>;
			actorId: string;
		},
	): AuditLogEntry[] {
		const { completedTask, documentCompleted, resolvedEscalations, reviewCaseUpdateData, actorId } =
			context;
		const entries: AuditLogEntry[] = [];

		entries.push(
			this.auditService.buildTaskEntry({
				action: AUDIT_ACTION.TASK_COMPLETED,
				before: task,
				after: completedTask,
				actor: actorId,
				documentCompleted: documentCompleted ?? undefined,
			}),
		);

		for (const escalation of resolvedEscalations) {
			entries.push(
				this.auditService.buildEscalationEntry({
					action: AUDIT_ACTION.ESCALATION_RESOLVED,
					before: {
						id: escalation.id,
						caseId: escalation.caseId,
						ruleId: escalation.ruleId,
						status: ESCALATION_STATUS.ACTIVE,
					},
					after: {
						id: escalation.id,
						caseId: escalation.caseId,
						ruleId: escalation.ruleId,
						status: ESCALATION_STATUS.RESOLVED,
						resolvedReason: RESOLVED_REASON.CASE_COMPLETED,
					},
					actor: actorId,
				}),
			);
		}

		if (Object.keys(reviewCaseUpdateData).length > 0) {
			const afterData = {
				id: task.caseId,
				caseReference: task.case.caseReference,
				...reviewCaseUpdateData,
			};

			entries.push(
				this.auditService.buildReviewCaseEntry({
					action: AUDIT_ACTION.CASE_UPDATED,
					before: pickFieldsFrom(task.case, afterData),
					after: afterData,
					actor: actorId,
				}),
			);
		}

		return entries;
	}

	async reassign(taskId: string, dto: ReassignTaskDto, actor: ActorContext): Promise<TaskDto> {
		const task = await this.prisma.task.findUnique({ where: { id: taskId } });

		if (!task) {
			throw new AppNotFoundException('Task not found');
		}

		assertActorOnAssignedTeam(actor, task.assignedTeam, task.assignedUser);

		return this.prisma.$transaction(async (tx) => {
			const updatedTask = await tx.task.update({
				where: { id: taskId },
				data: {
					assignedTeam: dto.assigned_team,
					assignedUser: dto.assigned_user ?? null,
				},
			});

			await this.auditService.auditTask(tx, {
				action: AUDIT_ACTION.TASK_REASSIGNED,
				before: task,
				after: updatedTask,
				actor: actor.actorId,
			});

			return this.toTaskDto(updatedTask);
		});
	}

	private toTaskDto(task: Task): TaskDto {
		return plainToInstance(TaskDto, {
			id: task.id,
			case_id: task.caseId,
			rule_id: task.ruleId,
			title: task.title,
			reason: task.reason,
			description: task.description,
			severity: task.severity,
			severity_rank: task.severityRank,
			suggested_action: task.suggestedAction,
			due_date: formatDateOnly(task.dueDate),
			assigned_team: task.assignedTeam,
			assigned_user: task.assignedUser,
			status: task.status,
			document_type: task.documentType,
			resolution_comment: task.resolutionComment,
			created_at: task.createdAt.toISOString(),
			updated_at: task.updatedAt.toISOString(),
		});
	}
}
