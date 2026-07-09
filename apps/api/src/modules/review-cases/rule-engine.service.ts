import { Injectable } from '@nestjs/common';
import { Prisma, type Escalation, type ReviewCase, type Task } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { v7 as uuidv7 } from 'uuid';
import { AppConflictException } from '../../common/exceptions/exception';
import { PrismaService } from '../../database/prisma.service';
import {
	applyEscalation,
	APPLY_ESCALATION_ACTION,
	AUDIT_ACTION,
	CASE_STATUS,
	computeRiskRollup,
	evaluate,
	ESCALATION_STATUS,
	loadRulesConfig,
	RESOLVED_REASON,
	SEVERITY_RANK,
	TASK_STATUS,
	type DocumentType,
	type EscalationLike,
	type EvaluatedEscalation,
	type RuleDefinition,
	type RuleResult,
	type ActorContext,
	type Severity,
	RiskRollup,
} from '../../domain';
import { AuditService } from '../audit/audit.service';
import { RunRulesResponseDto } from './dto/run-rules-response.dto';
import { ReviewCasesService } from './review-cases.service';

type TransactionClient = Prisma.TransactionClient;

interface EscalationAuditChange {
	action: typeof AUDIT_ACTION.ESCALATION_CREATED | typeof AUDIT_ACTION.ESCALATION_SUPERSEDED;
	escalationId: string;
	ruleId: string;
	severity: string;
}

interface RuleExecutionOutcome {
	tasks: Task[];
	escalations: Escalation[];
	riskRollup: ReturnType<typeof computeRiskRollup>;
}

@Injectable()
export class RuleEngineService {
	private readonly rules: RuleDefinition[] = loadRulesConfig();

	constructor(
		private readonly prisma: PrismaService,
		private readonly reviewCasesService: ReviewCasesService,
		private readonly auditService: AuditService,
	) {}

	async runRules(idOrRef: string, actor: ActorContext): Promise<RunRulesResponseDto> {
		const reviewCase = await this.reviewCasesService.resolveReviewCase(idOrRef);

		if (reviewCase.status === CASE_STATUS.COMPLETED) {
			throw new AppConflictException('Cannot run rules on a completed case', {
				status: reviewCase.status,
			});
		}

		const now = new Date();
		const results = this.evaluateCase(reviewCase, now);

		const outcome = await this.prisma.$transaction((tx) =>
			this.applyRuleResults(tx, reviewCase, results, now, actor),
		);

		return this.toRunRulesResponse(
			outcome.riskRollup.riskLevel,
			outcome.tasks,
			outcome.escalations,
		);
	}

	evaluateCase(reviewCase: ReviewCase, now: Date = new Date()): RuleResult[] {
		return evaluate(
			{
				requiredDocuments: reviewCase.requiredDocuments as DocumentType[],
				completedDocuments: reviewCase.completedDocuments as DocumentType[],
				packagingType: reviewCase.packagingType as never,
				ispm15Certified: reviewCase.ispm15Certified,
				invoiceValue: reviewCase.invoiceValue.toNumber(),
				deadline: reviewCase.deadline,
			},
			this.rules,
			now,
		);
	}

	private async applyRuleResults(
		tx: TransactionClient,
		reviewCase: ReviewCase,
		results: RuleResult[],
		now: Date,
		actor: ActorContext,
	): Promise<RuleExecutionOutcome> {
		const taskResults = results.filter((result) => result.task);
		const escalationResults = results.filter((result) => result.escalation);

		const newlyCreatedRuleIds = await this.persistNewTasks(tx, reviewCase, taskResults);
		const escalationChanges = await this.persistEscalationChanges(
			tx,
			reviewCase,
			escalationResults,
			now,
		);

		const tasks = await tx.task.findMany({
			where: { caseId: reviewCase.id },
			orderBy: { createdAt: 'asc' },
		});

		const escalations = await tx.escalation.findMany({
			where: { caseId: reviewCase.id },
			orderBy: { createdAt: 'asc' },
		});

		const riskRollup = await this.reviewCasesService.syncCaseRiskRollup(
			tx,
			reviewCase.id,
			tasks,
			escalations,
			{ status: CASE_STATUS.IN_REVIEW },
		);

		await this.writeRuleExecutionAudits(tx, reviewCase, {
			matchedRuleIds: results.map((result) => result.ruleId),
			newlyCreatedRuleIds,
			escalationChanges,
			riskRollup,
			tasks,
			actorId: actor.actorId,
		});

		return { tasks, escalations, riskRollup };
	}

	private async persistNewTasks(
		tx: TransactionClient,
		reviewCase: ReviewCase,
		taskResults: RuleResult[],
	): Promise<string[]> {
		if (taskResults.length === 0) {
			return [];
		}

		const existingTasks = await tx.task.findMany({
			where: {
				caseId: reviewCase.id,
				ruleId: { in: taskResults.map((result) => result.ruleId) },
			},
			select: { ruleId: true },
		});

		const existingRuleIds = new Set(existingTasks.map((task) => task.ruleId));
		const newlyCreatedRuleIds: string[] = [];

		for (const result of taskResults) {
			const taskOutcome = result.task;

			if (existingRuleIds.has(result.ruleId) || !taskOutcome) {
				continue;
			}

			await tx.task.create({
				data: this.buildTaskCreateData(reviewCase, result, taskOutcome),
			});

			existingRuleIds.add(result.ruleId);

			newlyCreatedRuleIds.push(result.ruleId);
		}

		return newlyCreatedRuleIds;
	}

	private buildTaskCreateData(
		reviewCase: ReviewCase,
		result: RuleResult,
		task: NonNullable<RuleResult['task']>,
	): Prisma.TaskUncheckedCreateInput {
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
			status: TASK_STATUS.OPEN,
			documentType: result.documentType ?? null,
			ruleSnapshot: result.rule as unknown as Prisma.InputJsonValue,
		};
	}

	private async persistEscalationChanges(
		tx: TransactionClient,
		reviewCase: ReviewCase,
		escalationResults: RuleResult[],
		now: Date,
	): Promise<EscalationAuditChange[]> {
		if (escalationResults.length === 0) {
			return [];
		}

		const escalationTypes = [
			...new Set(
				escalationResults.flatMap((result) => (result.escalation ? [result.escalation.type] : [])),
			),
		];

		const activeEscalations = await tx.escalation.findMany({
			where: {
				caseId: reviewCase.id,
				status: ESCALATION_STATUS.ACTIVE,
				type: { in: escalationTypes },
			},
		});

		const activeByType = new Map(
			activeEscalations.map((escalation) => [escalation.type, escalation]),
		);
		const changes: EscalationAuditChange[] = [];

		for (const result of escalationResults) {
			const escalation = result.escalation;

			if (!escalation) {
				continue;
			}

			const existingActive = activeByType.get(escalation.type) ?? null;

			const action = applyEscalation(
				existingActive ? toEscalationLike(existingActive) : null,
				toEvaluatedEscalation(result.ruleId, escalation),
			);

			if (action === APPLY_ESCALATION_ACTION.NOOP) {
				continue;
			}

			if (action === APPLY_ESCALATION_ACTION.SUPERSEDE && existingActive) {
				await tx.escalation.update({
					where: { id: existingActive.id },
					data: {
						status: ESCALATION_STATUS.RESOLVED,
						resolvedAt: now,
						resolvedReason: RESOLVED_REASON.SUPERSEDED,
					},
				});

				activeByType.delete(existingActive.type);

				changes.push({
					action: AUDIT_ACTION.ESCALATION_SUPERSEDED,
					escalationId: existingActive.id,
					ruleId: existingActive.ruleId,
					severity: existingActive.severity,
				});
			}

			const createdEscalation = await tx.escalation.create({
				data: {
					id: uuidv7(),
					caseId: reviewCase.id,
					ruleId: result.ruleId,
					type: escalation.type,
					severity: escalation.severity,
					reason: escalation.reason,
					suggestedAction: escalation.suggestedAction,
					status: ESCALATION_STATUS.ACTIVE,
					ruleSnapshot: result.rule as unknown as Prisma.InputJsonValue,
				},
			});

			activeByType.set(createdEscalation.type, createdEscalation);

			changes.push({
				action: AUDIT_ACTION.ESCALATION_CREATED,
				escalationId: createdEscalation.id,
				ruleId: result.ruleId,
				severity: escalation.severity,
			});
		}

		return changes;
	}

	private async writeRuleExecutionAudits(
		tx: TransactionClient,
		reviewCase: Pick<ReviewCase, 'id' | 'caseReference'>,
		context: {
			matchedRuleIds: string[];
			newlyCreatedRuleIds: string[];
			escalationChanges: EscalationAuditChange[];
			riskRollup: RiskRollup;
			tasks: Task[];
			actorId: string;
		},
	): Promise<void> {
		const { matchedRuleIds, newlyCreatedRuleIds, escalationChanges, riskRollup, tasks, actorId } =
			context;

		await this.auditService.auditReviewCase(tx, {
			action: AUDIT_ACTION.RULES_EXECUTED,
			after: { id: reviewCase.id, caseReference: reviewCase.caseReference, riskLevel: riskRollup.riskLevel },
			matchedRules: matchedRuleIds,
			createdRuleIds: newlyCreatedRuleIds,
			actor: actorId,
		});

		const createdRuleIdSet = new Set(newlyCreatedRuleIds);

		for (const task of tasks) {
			if (!createdRuleIdSet.has(task.ruleId)) {
				continue;
			}

			await this.auditService.auditTask(tx, {
				action: AUDIT_ACTION.TASK_CREATED,
				after: task,
				actor: 'system',
			});
		}

		for (const change of escalationChanges) {
			await this.auditService.auditEscalation(tx, {
				action: change.action,
				after: {
					id: change.escalationId,
					caseId: reviewCase.id,
					ruleId: change.ruleId,
					severity: change.severity,
					...(change.action === AUDIT_ACTION.ESCALATION_SUPERSEDED
						? { resolvedReason: RESOLVED_REASON.SUPERSEDED }
						: {}),
				},
				actor: 'system',
			});
		}
	}

	private toRunRulesResponse(
		riskLevel: string,
		tasks: Task[],
		escalations: Escalation[],
	): RunRulesResponseDto {
		const activeEscalations = escalations.filter(
			(escalation) => escalation.status === ESCALATION_STATUS.ACTIVE,
		);

		return plainToInstance(RunRulesResponseDto, {
			risk_level: riskLevel,
			tasks: tasks.length,
			escalations: activeEscalations.length,
		});
	}
}

function toEscalationLike(escalation: Escalation): EscalationLike {
	return {
		type: escalation.type as EscalationLike['type'],
		ruleId: escalation.ruleId,
		severity: escalation.severity as Severity,
		status: escalation.status as EscalationLike['status'],
	};
}

function toEvaluatedEscalation(
	ruleId: string,
	escalation: NonNullable<RuleResult['escalation']>,
): EvaluatedEscalation {
	return {
		type: escalation.type as EvaluatedEscalation['type'],
		ruleId,
		severity: escalation.severity,
		reason: escalation.reason,
		suggestedAction: escalation.suggestedAction,
	};
}
