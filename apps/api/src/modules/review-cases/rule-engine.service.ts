import { Injectable } from '@nestjs/common';
import { Prisma, type Escalation, type ReviewCase, type Task } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { v7 as uuidv7 } from 'uuid';
import { AppConflictException } from '../../common/exceptions/exception';
import { PrismaService } from '../../database/prisma.service';
import {
	AUDIT_ACTION,
	CASE_STATUS,
	computeRiskRollup,
	matchRules,
	ESCALATION_STATUS,
	isTerminalTaskStatus,
	loadRulesConfig,
	RESOLVED_REASON,
	SEVERITY_RANK,
	TASK_STATUS,
	type ActorContext,
	type DocumentType,
	type RiskRollup,
	type RuleDefinition,
	type RuleEscalationOutcome,
	type RuleTaskOutcome,
	type Severity,
	RiskRollupItem,
} from '../../domain';
import {
	AuditService,
	CaseAuditEntity,
	EscalationAuditEntity,
	type AuditLogEntry,
} from '../audit/audit.service';
import { RunRulesResponseDto } from './dto/run-rules-response.dto';
import { ReviewCasesService } from './review-cases.service';
import { pickFieldsFrom } from '../../common/utils/pick-fields-from';

type TransactionClient = Prisma.TransactionClient;

interface PreEvaluation {
	taskActive: Task[];
	escActive: Escalation[];
	doneRuleIdSet: Set<string>;
}

interface Evaluation {
	isCaseReadyComplete: boolean;
	riskRollup: RiskRollup;
	newTasks: Prisma.TaskUncheckedCreateInput[];
	newEscalations: Prisma.EscalationUncheckedCreateInput[];
	resolveEscalationIds: string[];
}

interface RunRulesOutcome {
	riskLevel: string;
	results: Array<{
		rule_id: string;
		trigger_reason: string;
		task: { id: string; title: string; severity: string } | null;
		escalation: { id: string; type: string; severity: string } | null;
		severity: string;
		suggested_action: string;
	}>;
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

		const outcome = await this.prisma.$transaction(async (tx) => {
			const preEvaluation = await this.preEvaluate(tx, reviewCase);

			const { evaluation, matchedRules } = this.evaluate(reviewCase, preEvaluation, now);

			return this.apply(tx, reviewCase, matchedRules, evaluation, actor);
		});

		return plainToInstance(RunRulesResponseDto, {
			risk_level: outcome.riskLevel,
			results: outcome.results,
		});
	}

	private async preEvaluate(tx: TransactionClient, reviewCase: ReviewCase): Promise<PreEvaluation> {
		const [allTasks, escActive] = await Promise.all([
			tx.task.findMany({ where: { caseId: reviewCase.id }, orderBy: { createdAt: 'asc' } }),
			tx.escalation.findMany({
				where: { caseId: reviewCase.id, status: ESCALATION_STATUS.ACTIVE },
				orderBy: { createdAt: 'asc' },
			}),
		]);

		const taskActive = allTasks.filter((task) => !isTerminalTaskStatus(task.status));
		const doneRuleIdSet = new Set(allTasks.map((task) => task.ruleId));

		return { taskActive, escActive, doneRuleIdSet };
	}

	private evaluate(
		reviewCase: ReviewCase,
		pre: PreEvaluation,
		now: Date,
	): { evaluation: Evaluation; matchedRules: RuleDefinition[] } {
		const matchedRules = matchRules(
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

		const activeEscByType = new Map(pre.escActive.map((esc) => [esc.type, esc]));
		const seenRuleIds = new Set(pre.doneRuleIdSet);

		const newTasks: Prisma.TaskUncheckedCreateInput[] = [];
		const newEscalationsTemp: Prisma.EscalationUncheckedCreateInput[] = [];
		const resolveEscalationIdsSet = new Set<string>();

		for (const rule of matchedRules) {
			if (seenRuleIds.has(rule.ruleId)) {
				continue;
			}

			if (rule.task) {
				newTasks.push(this.planTaskCreateData(reviewCase, rule, rule.task));

				seenRuleIds.add(rule.ruleId);
			}

			if (rule.escalation) {
				const existing = activeEscByType.get(rule.escalation.type) ?? null;

				if (
					existing &&
					SEVERITY_RANK[existing.severity as Severity] >=
						SEVERITY_RANK[rule.escalation.severity as Severity]
				) {
					continue;
				}

				const planned = this.planEscalationCreateData(reviewCase, rule, rule.escalation);

				newEscalationsTemp.push(planned);

				if (existing) {
					resolveEscalationIdsSet.add(existing.id);
				}
			}
		}

		const isCaseReadyComplete = pre.taskActive.length + newTasks.length === 0;

		const newEscalations = isCaseReadyComplete ? [] : newEscalationsTemp;
		const resolveEscalationIds = isCaseReadyComplete
			? pre.escActive.map((escalation) => escalation.id)
			: Array.from(resolveEscalationIdsSet);

		const activeEscalations = pre.escActive.filter(
			(escalation) => !resolveEscalationIdsSet.has(escalation.id),
		);

		const riskRollup = computeRiskRollup([
			...(pre.taskActive as RiskRollupItem[]),
			...(newTasks as RiskRollupItem[]),
			...(!isCaseReadyComplete
				? [...(activeEscalations as RiskRollupItem[]), ...(newEscalations as RiskRollupItem[])]
				: []),
		]);

		const evaluation: Evaluation = {
			isCaseReadyComplete,
			riskRollup,
			newTasks,
			newEscalations,
			resolveEscalationIds,
		};

		return { evaluation, matchedRules };
	}

	private planTaskCreateData(
		reviewCase: ReviewCase,
		rule: RuleDefinition,
		task: RuleTaskOutcome,
	): Prisma.TaskUncheckedCreateInput {
		return {
			id: uuidv7(),
			caseId: reviewCase.id,
			ruleId: rule.ruleId,
			title: task.title,
			reason: rule.reason,
			description: task.description,
			severity: task.severity,
			severityRank: SEVERITY_RANK[task.severity],
			suggestedAction: task.suggestedAction,
			dueDate: reviewCase.deadline,
			assignedTeam: task.assignedTeam,
			status: TASK_STATUS.OPEN,
			documentType: (rule.when.params.documentType as DocumentType | undefined) ?? null,
			ruleSnapshot: rule as unknown as Prisma.InputJsonValue,
		};
	}

	private planEscalationCreateData(
		reviewCase: ReviewCase,
		rule: RuleDefinition,
		escalation: RuleEscalationOutcome,
	): Prisma.EscalationUncheckedCreateInput {
		return {
			id: uuidv7(),
			caseId: reviewCase.id,
			ruleId: rule.ruleId,
			type: escalation.type,
			severity: escalation.severity,
			reason: escalation.reason,
			suggestedAction: escalation.suggestedAction,
			status: ESCALATION_STATUS.ACTIVE,
			ruleSnapshot: rule as unknown as Prisma.InputJsonValue,
		};
	}

	private async apply(
		tx: TransactionClient,
		reviewCase: ReviewCase,
		matchedRules: RuleDefinition[],
		evaluation: Evaluation,
		actor: ActorContext,
	): Promise<RunRulesOutcome> {
		const { isCaseReadyComplete, riskRollup, newTasks, newEscalations, resolveEscalationIds } =
			evaluation;

		const newRuleIds = [
			...newTasks.map((task) => task.ruleId),
			...newEscalations.map((escalation) => escalation.ruleId),
		];

		if (resolveEscalationIds.length > 0) {
			await tx.escalation.updateMany({
				where: { id: { in: resolveEscalationIds } },
				data: {
					status: ESCALATION_STATUS.RESOLVED,
					resolvedAt: new Date(),
					resolvedReason: isCaseReadyComplete
						? RESOLVED_REASON.CASE_COMPLETED
						: RESOLVED_REASON.SUPERSEDED,
				},
			});
		}

		if (newTasks.length > 0) {
			await tx.task.createMany({ data: newTasks });
		}

		if (newEscalations.length > 0) {
			await tx.escalation.createMany({ data: newEscalations });
		}

		const nextStatus = isCaseReadyComplete ? CASE_STATUS.COMPLETED : CASE_STATUS.IN_REVIEW;

		const reviewCaseUpdateData: Partial<ReviewCase> = {};

		if (nextStatus !== reviewCase.status) {
			reviewCaseUpdateData.status = nextStatus;
		}

		if (riskRollup.riskRank !== reviewCase.riskRank) {
			reviewCaseUpdateData.riskRank = riskRollup.riskRank;

			reviewCaseUpdateData.riskLevel = riskRollup.riskLevel;
		}

		if (Object.keys(reviewCaseUpdateData).length > 0) {
			await tx.reviewCase.update({
				where: { id: reviewCase.id },
				data: reviewCaseUpdateData,
			});
		}

		await this.auditService.auditMany(
			tx,
			this.buildRuleExecutionAudits(reviewCase, {
				isCaseReadyComplete,
				reviewCaseUpdateData,
				newTasks,
				newEscalations,
				matchedRuleIds: matchedRules.map((result) => result.ruleId),
				newRuleIds,
				resolveEscalationIds,
				actorId: actor.actorId,
			}),
		);

		return {
			riskLevel: riskRollup.riskLevel,
			results: this.buildRuleResults(newTasks, newEscalations),
		};
	}

	private buildRuleResults(
		newTasks: Prisma.TaskUncheckedCreateInput[],
		newEscalations: Prisma.EscalationUncheckedCreateInput[],
	): RunRulesOutcome['results'] {
		const results: RunRulesOutcome['results'] = [];

		for (const task of newTasks) {
			results.push({
				rule_id: task.ruleId,
				trigger_reason: task.reason,
				task: {
					id: task.id,
					title: task.title,
					severity: task.severity,
				},
				escalation: null,
				severity: task.severity,
				suggested_action: task.suggestedAction,
			});
		}

		for (const escalation of newEscalations) {
			results.push({
				rule_id: escalation.ruleId,
				trigger_reason: escalation.reason,
				task: null,
				escalation: {
					id: escalation.id,
					type: escalation.type,
					severity: escalation.severity,
				},
				severity: escalation.severity,
				suggested_action: escalation.suggestedAction,
			});
		}

		return results;
	}

	private buildRuleExecutionAudits(
		reviewCase: ReviewCase,
		context: {
			isCaseReadyComplete: boolean;
			matchedRuleIds: string[];
			newTasks: Prisma.TaskUncheckedCreateInput[];
			newEscalations: Prisma.EscalationUncheckedCreateInput[];
			newRuleIds: string[];
			reviewCaseUpdateData: Prisma.ReviewCaseUncheckedUpdateInput;
			resolveEscalationIds: string[];
			actorId: string;
		},
	): AuditLogEntry[] {
		const {
			isCaseReadyComplete,
			matchedRuleIds,
			newTasks,
			newEscalations,
			newRuleIds,
			reviewCaseUpdateData,
			resolveEscalationIds,
			actorId,
		} = context;
		const entries: AuditLogEntry[] = [];

		const reviewCaseAfter = {
			...reviewCaseUpdateData,
			id: reviewCase.id,
			caseReference: reviewCase.caseReference,
		} as CaseAuditEntity;

		entries.push(
			this.auditService.buildReviewCaseEntry({
				action: AUDIT_ACTION.RULES_EXECUTED,
				before: pickFieldsFrom(reviewCase, reviewCaseAfter),
				after: reviewCaseAfter,
				matchedRules: matchedRuleIds,
				createdRuleIds: newRuleIds,
				actor: actorId,
			}),
		);

		for (const task of newTasks) {
			entries.push(
				this.auditService.buildTaskEntry({
					action: AUDIT_ACTION.TASK_CREATED,
					after: {
						id: task.id,
						caseId: reviewCase.id,
						title: task.title,
						ruleId: task.ruleId,
						severity: task.severity,
					},
					actor: 'system',
				}),
			);
		}

		for (const escalationId of resolveEscalationIds) {
			entries.push(
				this.auditService.buildEscalationEntry({
					action: AUDIT_ACTION.ESCALATION_RESOLVED,
					before: {
						id: escalationId,
						caseId: reviewCase.id,
						status: ESCALATION_STATUS.ACTIVE,
					},
					after: {
						id: escalationId,
						caseId: reviewCase.id,
						status: ESCALATION_STATUS.RESOLVED,
						resolvedReason: isCaseReadyComplete
							? RESOLVED_REASON.CASE_COMPLETED
							: RESOLVED_REASON.SUPERSEDED,
					},
					actor: 'system',
				}),
			);
		}

		for (const escalation of newEscalations) {
			entries.push(
				this.auditService.buildEscalationEntry({
					action: AUDIT_ACTION.ESCALATION_CREATED,
					after: escalation as EscalationAuditEntity,
					actor: 'system',
				}),
			);
		}

		return entries;
	}
}
