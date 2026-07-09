import { timeRemainingHours } from './deadline';
import { isWoodPackaging } from './packaging';
import { RISK_LEVEL, SEVERITY_RANK, type RiskLevel, type Severity } from './severity';
import { TASK_STATUS } from './task-status';
import { ESCALATION_STATUS, type DocumentType, type PackagingType } from './types';
import type { RuleDefinition, RuleEscalationOutcome, RuleTaskOutcome } from './rules-config';

export interface ReviewCaseLike {
	requiredDocuments: DocumentType[];
	completedDocuments: DocumentType[];
	packagingType?: PackagingType | null;
	ispm15Certified?: boolean | null;
	invoiceValue: number;
	deadline: Date;
}

export type Predicate = (c: ReviewCaseLike, params: Record<string, unknown>, now?: Date) => boolean;

export interface RuleResult {
	ruleId: string;
	version: number;
	reason: string;
	task?: RuleTaskOutcome;
	escalation?: RuleEscalationOutcome;
	documentType?: DocumentType;
	rule: RuleDefinition;
}

export function missingDocuments(c: ReviewCaseLike): DocumentType[] {
	const completed = new Set(c.completedDocuments);

	return c.requiredDocuments.filter((doc) => !completed.has(doc));
}

export const missingDocumentPredicate: Predicate = (c, params) =>
	missingDocuments(c).includes(params.documentType as DocumentType);

export const woodUncertifiedPredicate: Predicate = (c) =>
	isWoodPackaging(c.packagingType ?? undefined) && c.ispm15Certified !== true;

export const highValuePredicate: Predicate = (c, params) =>
	c.invoiceValue > (params.threshold as number);

export const deadlineApproachingPredicate: Predicate = (c, params, now) => {
	const hoursLeft = timeRemainingHours(c.deadline, now);
	const hoursThreshold = params.hoursThreshold as number;

	return hoursLeft >= 0 && hoursLeft < hoursThreshold;
};

export const deadlinePassedPredicate: Predicate = (c, _params, now) =>
	timeRemainingHours(c.deadline, now) < 0;

export const PREDICATE_REGISTRY: Record<string, Predicate> = {
	missing_document: missingDocumentPredicate,
	wood_uncertified: woodUncertifiedPredicate,
	high_value: highValuePredicate,
	deadline_approaching: deadlineApproachingPredicate,
	deadline_passed: deadlinePassedPredicate,
};

export function evaluate(
	reviewCase: ReviewCaseLike,
	rules: RuleDefinition[],
	now: Date = new Date(),
): RuleResult[] {
	const results: RuleResult[] = [];

	for (const rule of rules) {
		if (!rule.enabled) {
			continue;
		}

		const predicate = PREDICATE_REGISTRY[rule.when.trigger];

		if (!predicate) {
			continue;
		}

		if (predicate(reviewCase, rule.when.params, now)) {
			const documentType = rule.when.params.documentType as DocumentType | undefined;

			results.push({
				ruleId: rule.ruleId,
				version: rule.version,
				reason: rule.reason,
				task: rule.task,
				escalation: rule.escalation,
				rule,
				...(documentType !== undefined ? { documentType } : {}),
			});
		}
	}

	return results;
}

export type RiskRollupItem = {
	severity: Severity;
	status: string;
};

export interface RiskRollup {
	riskLevel: RiskLevel;
	riskRank: number;
}

export function computeRiskRollup(items: RiskRollupItem[]): RiskRollup {
	const inactiveStatuses = [
		TASK_STATUS.COMPLETED,
		TASK_STATUS.CANCELLED,
		ESCALATION_STATUS.RESOLVED,
	];

	const activeItems = items.filter((item) => !inactiveStatuses.includes(item.status as never));

	if (activeItems.length === 0) {
		return { riskLevel: RISK_LEVEL.LOW, riskRank: SEVERITY_RANK.low };
	}

	let highest: Severity = RISK_LEVEL.LOW;

	for (const item of activeItems) {
		if (SEVERITY_RANK[item.severity] > SEVERITY_RANK[highest]) {
			highest = item.severity;
		}
	}

	return { riskLevel: highest, riskRank: SEVERITY_RANK[highest] };
}
