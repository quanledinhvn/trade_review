import { Injectable } from '@nestjs/common';
import { type Escalation, type Task } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { AppConflictException, AppNotFoundException } from '../../common/exceptions/exception';
import { PrismaService } from '../../database/prisma.service';
import {
	assertActorOnAssignedTeam,
	AUDIT_ACTION,
	CASE_STATUS,
	ESCALATION_STATUS,
	formatDateOnly,
	isCaseReadyToComplete,
	RESOLVED_REASON,
	TASK_STATUS,
	type ActorContext,
} from '../../domain';
import { AuditService } from '../audit/audit.service';
import { ReviewCasesService } from '../review-cases/review-cases.service';
import { CompleteTaskResponseDto } from './dto/complete-task-response.dto';
import type { CompleteTaskDto } from './dto/complete-task.dto';
import type { ReassignTaskDto } from './dto/reassign-task.dto';
import { TaskDto } from './dto/task.dto';

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

		return this.prisma.$transaction(async (tx) => {
			const caseBefore = {
				status: task.case.status,
				riskLevel: task.case.riskLevel,
			};

			const updatedTask = await tx.task.update({
				where: { id: taskId },
				data: {
					status: TASK_STATUS.COMPLETED,
					resolutionComment: dto.resolution_comment ?? null,
				},
			});

			let documentCompleted: string | undefined;

			if (task.documentType && !task.case.completedDocuments.includes(task.documentType)) {
				await tx.reviewCase.update({
					where: { id: task.caseId },
					data: { completedDocuments: { push: task.documentType } },
				});

				documentCompleted = task.documentType;
			}

			const tasks = await tx.task.findMany({ where: { caseId: task.caseId } });
			const caseReady = task.case.status !== CASE_STATUS.COMPLETED && isCaseReadyToComplete(tasks);

			let resolvedEscalations: Escalation[] = [];

			if (caseReady) {
				const now = new Date();

				resolvedEscalations = await tx.escalation.findMany({
					where: { caseId: task.caseId, status: ESCALATION_STATUS.ACTIVE },
				});

				await tx.reviewCase.update({
					where: { id: task.caseId },
					data: { status: CASE_STATUS.COMPLETED },
				});

				await tx.escalation.updateMany({
					where: { caseId: task.caseId, status: ESCALATION_STATUS.ACTIVE },
					data: {
						status: ESCALATION_STATUS.RESOLVED,
						resolvedAt: now,
						resolvedReason: RESOLVED_REASON.CASE_COMPLETED,
					},
				});
			}

			const escalations = await tx.escalation.findMany({ where: { caseId: task.caseId } });
			const riskRollup = await this.reviewCasesService.syncCaseRiskRollup(
				tx,
				task.caseId,
				tasks,
				escalations,
			);

			await this.auditService.auditTask(tx, {
				action: AUDIT_ACTION.TASK_COMPLETED,
				before: task,
				after: updatedTask,
				documentCompleted,
				actor: actor.actorId,
			});

			const statusChanged = caseReady;
			const riskChanged = riskRollup.riskLevel !== caseBefore.riskLevel;

			if (statusChanged || riskChanged) {
				await this.auditService.auditReviewCase(tx, {
					action: AUDIT_ACTION.CASE_UPDATED,
					before: {
						id: task.case.id,
						caseReference: task.case.caseReference,
						...(statusChanged ? { status: caseBefore.status } : {}),
						...(riskChanged ? { riskLevel: caseBefore.riskLevel } : {}),
					},
					after: {
						id: task.case.id,
						caseReference: task.case.caseReference,
						...(statusChanged ? { status: CASE_STATUS.COMPLETED } : {}),
						...(riskChanged ? { riskLevel: riskRollup.riskLevel } : {}),
					},
					actor: actor.actorId,
				});
			}

			for (const escalation of resolvedEscalations) {
				await this.auditService.auditEscalation(tx, {
					action: AUDIT_ACTION.ESCALATION_RESOLVED,
					before: {
						id: escalation.id,
						caseId: escalation.caseId,
						ruleId: escalation.ruleId,
						severity: escalation.severity,
						status: ESCALATION_STATUS.ACTIVE,
					},
					after: {
						id: escalation.id,
						caseId: escalation.caseId,
						ruleId: escalation.ruleId,
						severity: escalation.severity,
						status: ESCALATION_STATUS.RESOLVED,
						resolvedReason: RESOLVED_REASON.CASE_COMPLETED,
					},
					actor: actor.actorId,
				});
			}

			return plainToInstance(CompleteTaskResponseDto, {
				id: updatedTask.id,
				status: updatedTask.status,
				resolution_comment: updatedTask.resolutionComment,
				updated_at: updatedTask.updatedAt.toISOString(),
				...(documentCompleted ? { document_completed: documentCompleted } : {}),
			});
		});
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
