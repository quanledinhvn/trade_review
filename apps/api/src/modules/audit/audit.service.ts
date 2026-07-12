import { Injectable } from '@nestjs/common';
import type { Escalation, Prisma, ReviewCase, Task } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';

import { AUDIT_ACTION } from '../../domain/audit';
import { AUDIT_ENTITY_TYPE } from '../../domain/audit';

type TransactionClient = Prisma.TransactionClient;

type Json = Prisma.InputJsonValue;

type TaskIdentity = Pick<Task, 'id' | 'caseId'>;

type TaskAuditEntity = TaskIdentity & Partial<Omit<Task, keyof TaskIdentity>>;

type CaseIdentity = Pick<ReviewCase, 'id' | 'caseReference'>;

export type CaseAuditEntity = CaseIdentity & Partial<Omit<ReviewCase, keyof CaseIdentity>>;

type EscalationIdentity = Pick<Escalation, 'id' | 'caseId'>;

export type EscalationAuditEntity = EscalationIdentity &
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
		| typeof AUDIT_ACTION.ESCALATION_RESOLVED;
	before?: EscalationAuditEntity;
	after: EscalationAuditEntity;
	actor: string;
};

export interface AuditLogEntry {
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

	/** Persist several audit entries in one round-trip. Ignores nulls. */
	async auditMany(
		tx: TransactionClient,
		entries: ReadonlyArray<AuditLogEntry | null>,
	): Promise<void> {
		const rows = entries.filter((entry): entry is AuditLogEntry => entry !== null);

		if (rows.length === 0) {
			return;
		}

		await tx.auditLog.createMany({
			data: rows.map((entry) => ({ id: uuidv7(), ...entry })),
		});
	}

	async auditTask(tx: TransactionClient, input: AuditTaskInput): Promise<void> {
		await this.write(tx, this.buildTaskEntry(input));
	}

	async auditReviewCase(tx: TransactionClient, input: AuditReviewCaseInput): Promise<void> {
		await this.write(tx, this.buildReviewCaseEntry(input));
	}

	async auditEscalation(tx: TransactionClient, input: AuditEscalationInput): Promise<void> {
		await this.write(tx, this.buildEscalationEntry(input));
	}

	buildTaskEntry(input: AuditTaskInput): AuditLogEntry {
		const { after, before, actor } = input;
		const { caseId, id: entityId } = after;

		switch (input.action) {
			case AUDIT_ACTION.TASK_CREATED:
				return {
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
					actor,
				};

			case AUDIT_ACTION.TASK_COMPLETED:
				return {
					caseId,
					action: input.action,
					entityType: AUDIT_ENTITY_TYPE.TASK,
					entityId,
					summary: `Task '${after.title}' completed`,
					before: { status: before?.status },
					after: {
						status: after.status,
						resolution_comment: after.resolutionComment ?? null,
						document_completed: input.documentCompleted,
					},
					actor,
				};

			case AUDIT_ACTION.TASK_REASSIGNED:
				return {
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
					actor,
				};
		}
	}

	buildReviewCaseEntry(input: AuditReviewCaseInput): AuditLogEntry {
		const { after, before } = input;
		const { id: caseId } = after;

		switch (input.action) {
			case AUDIT_ACTION.CASE_CREATED:
				return {
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
				};

			case AUDIT_ACTION.CASE_UPDATED: {
				return {
					caseId,
					action: input.action,
					entityType: AUDIT_ENTITY_TYPE.CASE,
					entityId: caseId,
					summary: `Case ${after.caseReference} updated`,
					before: { status: before?.status, risk_level: before?.riskLevel },
					after: { status: after.status, risk_level: after.riskLevel },
					actor: input.actor,
				};
			}

			case AUDIT_ACTION.RULES_EXECUTED:
				return {
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
				};
		}
	}

	buildEscalationEntry(input: AuditEscalationInput): AuditLogEntry {
		const { after, before, actor } = input;

		switch (input.action) {
			case AUDIT_ACTION.ESCALATION_RESOLVED:
				return {
					caseId: after.caseId,
					action: input.action,
					entityType: AUDIT_ENTITY_TYPE.ESCALATION,
					entityId: after.id,
					summary: `Escalation resolved for rule ${after.ruleId} (${after.resolvedReason})`,
					before: { status: before?.status },
					after: {
						status: after.status,
						resolved_reason: after.resolvedReason ?? null,
					},
					actor,
				};

			case AUDIT_ACTION.ESCALATION_CREATED:
				return {
					caseId: after.caseId,
					action: input.action,
					entityType: AUDIT_ENTITY_TYPE.ESCALATION,
					entityId: after.id,
					summary: `Escalation created for rule ${after.ruleId}`,
					after: {
						rule_id: after.ruleId,
						severity: after.severity,
					},
					actor,
				};
		}
	}
}
