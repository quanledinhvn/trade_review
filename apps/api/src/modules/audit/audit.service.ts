import { Injectable } from '@nestjs/common';
import type { Escalation, Prisma, ReviewCase, Task } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';

import { AUDIT_ACTION } from '../../domain/audit';
import { AUDIT_ENTITY_TYPE } from '../../domain/types';

type TransactionClient = Prisma.TransactionClient;

type Json = Prisma.InputJsonValue;

type TaskIdentity = Pick<Task, 'id' | 'caseId' | 'title'>;

type TaskAuditEntity = TaskIdentity & Partial<Omit<Task, keyof TaskIdentity>>;

type CaseIdentity = Pick<ReviewCase, 'id' | 'caseReference'>;

type CaseAuditEntity = CaseIdentity & Partial<Omit<ReviewCase, keyof CaseIdentity>>;

type EscalationIdentity = Pick<Escalation, 'id' | 'caseId' | 'ruleId' | 'severity'>;

type EscalationAuditEntity = EscalationIdentity &
	Partial<Omit<Escalation, keyof EscalationIdentity>>;

export type AuditTaskInput = {
	action:
		| typeof AUDIT_ACTION.TASK_CREATED
		| typeof AUDIT_ACTION.TASK_COMPLETED
		| typeof AUDIT_ACTION.TASK_REASSIGNED;
	before?: TaskAuditEntity;
	after: TaskAuditEntity;
	actor: string;
	documentCompleted?: string;
};

export type AuditReviewCaseInput = {
	action:
		| typeof AUDIT_ACTION.CASE_CREATED
		| typeof AUDIT_ACTION.CASE_UPDATED
		| typeof AUDIT_ACTION.RULES_EXECUTED;
	before?: CaseAuditEntity;
	after: CaseAuditEntity;
	actor: string;
	matchedRules?: string[];
	createdRuleIds?: string[];
};

export type AuditEscalationInput = {
	action:
		| typeof AUDIT_ACTION.ESCALATION_CREATED
		| typeof AUDIT_ACTION.ESCALATION_SUPERSEDED
		| typeof AUDIT_ACTION.ESCALATION_RESOLVED;
	before?: EscalationAuditEntity;
	after: EscalationAuditEntity;
	actor: string;
};

interface AuditLogEntry {
	caseId: string;
	action: string;
	entityType: string;
	entityId: string;
	summary: string;
	before?: Json;
	after?: Json;
	actor: string;
}

@Injectable()
export class AuditService {
	private async write(tx: TransactionClient, entry: AuditLogEntry): Promise<void> {
		await tx.auditLog.create({ data: { id: uuidv7(), ...entry } });
	}

	async auditTask(tx: TransactionClient, input: AuditTaskInput): Promise<void> {
		const { after, before } = input;
		const { caseId, id: entityId } = after;

		switch (input.action) {
			case AUDIT_ACTION.TASK_CREATED:
				await this.write(tx, {
					caseId,
					action: input.action,
					entityType: AUDIT_ENTITY_TYPE.TASK,
					entityId,
					summary: `Task '${after.title}' created for rule ${after.ruleId}`,
					after: {
						rule_id: after.ruleId,
						severity: after.severity,
						title: after.title,
					},
					actor: input.actor,
				});

				return;

			case AUDIT_ACTION.TASK_COMPLETED:
				await this.write(tx, {
					caseId,
					action: input.action,
					entityType: AUDIT_ENTITY_TYPE.TASK,
					entityId,
					summary: `Task '${after.title}' completed`,
					before: { status: before?.status },
					after: {
						status: after.status,
						resolution_comment: after.resolutionComment ?? null,
						...(input.documentCompleted ? { document_completed: input.documentCompleted } : {}),
					},
					actor: input.actor,
				});

				return;

			case AUDIT_ACTION.TASK_REASSIGNED:
				await this.write(tx, {
					caseId,
					action: input.action,
					entityType: AUDIT_ENTITY_TYPE.TASK,
					entityId,
					summary: `Task '${after.title}' reassigned`,
					before: {
						assigned_team: before?.assignedTeam,
						assigned_user: before?.assignedUser ?? null,
					},
					after: {
						assigned_team: after.assignedTeam,
						assigned_user: after.assignedUser ?? null,
					},
					actor: input.actor,
				});
		}
	}

	async auditReviewCase(tx: TransactionClient, input: AuditReviewCaseInput): Promise<void> {
		const { after, before } = input;
		const { id: caseId } = after;

		switch (input.action) {
			case AUDIT_ACTION.CASE_CREATED:
				await this.write(tx, {
					caseId,
					action: input.action,
					entityType: AUDIT_ENTITY_TYPE.CASE,
					entityId: caseId,
					summary: `Case ${after.caseReference} created`,
					after: {
						case_reference: after.caseReference,
						status: after.status,
						risk_level: after.riskLevel,
					},
					actor: input.actor,
				});

				return;

			case AUDIT_ACTION.CASE_UPDATED: {
				const beforeJson: Json = {};
				const afterJson: Json = {};
				const parts: string[] = [];

				if (before?.status !== undefined && after.status !== undefined) {
					(beforeJson as Record<string, unknown>).status = before.status;

					(afterJson as Record<string, unknown>).status = after.status;

					parts.push(`status ${before.status} -> ${after.status}`);
				}

				if (before?.riskLevel !== undefined && after.riskLevel !== undefined) {
					(beforeJson as Record<string, unknown>).risk_level = before.riskLevel;

					(afterJson as Record<string, unknown>).risk_level = after.riskLevel;

					parts.push(`risk_level ${before.riskLevel} -> ${after.riskLevel}`);
				}

				await this.write(tx, {
					caseId,
					action: input.action,
					entityType: AUDIT_ENTITY_TYPE.CASE,
					entityId: caseId,
					summary: `Case ${after.caseReference} updated${parts.length ? `: ${parts.join(', ')}` : ''}`,
					before: Object.keys(beforeJson as object).length > 0 ? beforeJson : undefined,
					after: afterJson,
					actor: input.actor,
				});

				return;
			}

			case AUDIT_ACTION.RULES_EXECUTED:
				await this.write(tx, {
					caseId,
					action: input.action,
					entityType: AUDIT_ENTITY_TYPE.CASE,
					entityId: caseId,
					summary: `Rule engine ran: ${input.matchedRules?.length ?? 0} rule(s) matched, ${input.createdRuleIds?.length ?? 0} task(s) created`,
					after: {
						matched_rules: input.matchedRules,
						created_rule_ids: input.createdRuleIds,
						risk_level: after.riskLevel,
					},
					actor: input.actor,
				});
		}
	}

	async auditEscalation(tx: TransactionClient, input: AuditEscalationInput): Promise<void> {
		const { after, before } = input;

		switch (input.action) {
			case AUDIT_ACTION.ESCALATION_RESOLVED:
				await this.write(tx, {
					caseId: after.caseId,
					action: input.action,
					entityType: AUDIT_ENTITY_TYPE.ESCALATION,
					entityId: after.id,
					summary: `Escalation resolved for rule ${after.ruleId} (${after.resolvedReason})`,
					before: { status: before?.status },
					after: {
						status: after.status,
						rule_id: after.ruleId,
						severity: after.severity,
						resolved_reason: after.resolvedReason,
					},
					actor: input.actor,
				});

				return;

			case AUDIT_ACTION.ESCALATION_SUPERSEDED:
				await this.write(tx, {
					caseId: after.caseId,
					action: input.action,
					entityType: AUDIT_ENTITY_TYPE.ESCALATION,
					entityId: after.id,
					summary: `Escalation superseded for rule ${after.ruleId}`,
					after: {
						rule_id: after.ruleId,
						severity: after.severity,
						...(after.resolvedReason ? { resolved_reason: after.resolvedReason } : {}),
					},
					actor: input.actor,
				});

				return;

			case AUDIT_ACTION.ESCALATION_CREATED:
				await this.write(tx, {
					caseId: after.caseId,
					action: input.action,
					entityType: AUDIT_ENTITY_TYPE.ESCALATION,
					entityId: after.id,
					summary: `Escalation created for rule ${after.ruleId}`,
					after: {
						rule_id: after.ruleId,
						severity: after.severity,
					},
					actor: input.actor,
				});
		}
	}
}
