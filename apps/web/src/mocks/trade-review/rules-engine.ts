import type {
	DocumentType,
	EscalationDto,
	PackagingType,
	ReviewCaseResponse,
	Severity,
	TaskDto,
} from '@/types';
import { SEVERITY_RANK } from '@/types/domain.types';

export interface RuleTaskOutcome {
	kind: 'task';
	rule_id: string;
	severity: Severity;
	title: string;
	description: string;
	suggested_action: string;
	assigned_team: string;
	document_type?: DocumentType;
	reason: string;
}

export interface RuleEscalationOutcome {
	kind: 'escalation';
	rule_id: string;
	severity: Severity;
	reason: string;
	suggested_action: string;
}

export type RuleOutcome = RuleTaskOutcome | RuleEscalationOutcome;

interface RuleDefinition {
	rule_id: string;
	evaluate: (caseItem: ReviewCaseResponse) => boolean;
	outcome: () => Omit<RuleTaskOutcome, 'kind'> | Omit<RuleEscalationOutcome, 'kind'>;
}

const WOOD_PACKAGING_TYPES = new Set<PackagingType>([
	'wooden_pallet',
	'wooden_crate',
	'natural_wood_box',
	'wooden_bundle',
	'wooden_box_ordinary',
]);

const HIGH_VALUE_THRESHOLD = 250_000;

function missingDocuments(caseItem: ReviewCaseResponse): DocumentType[] {
	const completed = new Set(caseItem.completed_documents);

	return caseItem.required_documents.filter((document) => !completed.has(document));
}

function isWoodPackaging(packagingType: string): boolean {
	return WOOD_PACKAGING_TYPES.has(packagingType as PackagingType);
}

function hoursLeft(caseItem: ReviewCaseResponse): number {
	return caseItem.time_remaining_hours;
}

const RULE_DEFINITIONS: RuleDefinition[] = [
	{
		rule_id: 'R-DOC-INVOICE',
		evaluate: (caseItem) => missingDocuments(caseItem).includes('commercial_invoice'),
		outcome: () => ({
			rule_id: 'R-DOC-INVOICE',
			severity: 'critical',
			title: 'Missing commercial invoice',
			description:
				'The commercial invoice is required for customs valuation but has not been provided.',
			suggested_action: 'Request commercial invoice from importer',
			assigned_team: 'trade_operations',
			document_type: 'commercial_invoice',
			reason: 'commercial_invoice is required but not completed',
		}),
	},
	{
		rule_id: 'R-DOC-PACKING',
		evaluate: (caseItem) => missingDocuments(caseItem).includes('packing_list'),
		outcome: () => ({
			rule_id: 'R-DOC-PACKING',
			severity: 'high',
			title: 'Missing packing list',
			description: 'Packing list has not been received for this shipment.',
			suggested_action: 'Request packing list from shipper',
			assigned_team: 'trade_operations',
			document_type: 'packing_list',
			reason: 'packing_list is required but not completed',
		}),
	},
	{
		rule_id: 'R-DOC-TRANSPORT',
		evaluate: (caseItem) => missingDocuments(caseItem).includes('transport_document'),
		outcome: () => ({
			rule_id: 'R-DOC-TRANSPORT',
			severity: 'critical',
			title: 'Missing transport document',
			description: 'Transport document (B/L or AWB) is required but not marked complete.',
			suggested_action: 'Request transport document from partner',
			assigned_team: 'trade_operations',
			document_type: 'transport_document',
			reason: 'transport_document is required but not completed',
		}),
	},
	{
		rule_id: 'R-WOOD-ISPM15',
		evaluate: (caseItem) => isWoodPackaging(caseItem.packaging_type) && !caseItem.ispm15_certified,
		outcome: () => ({
			rule_id: 'R-WOOD-ISPM15',
			severity: 'high',
			title: 'Wood packaging — ISPM-15 certification',
			description: 'Shipment uses solid wood packaging without ISPM-15 certification on file.',
			suggested_action: 'Verify fumigation certificate or request ISPM-15 stamp photo',
			assigned_team: 'trade_operations',
			reason: 'solid-wood packaging without ISPM-15 certification',
		}),
	},
	{
		rule_id: 'R-HIGH-VALUE',
		evaluate: (caseItem) => caseItem.invoice_value > HIGH_VALUE_THRESHOLD,
		outcome: () => ({
			rule_id: 'R-HIGH-VALUE',
			severity: 'high',
			title: 'High-value shipment — manager review',
			description: 'Invoice value exceeds manager-review threshold.',
			suggested_action: 'Assign to trade manager for approval',
			assigned_team: 'operation',
			reason: 'invoice value exceeds manager-review threshold',
		}),
	},
	{
		rule_id: 'R-DEADLINE-48H',
		evaluate: (caseItem) => {
			const hours = hoursLeft(caseItem);

			return hours >= 0 && hours < 48;
		},
		outcome: () => ({
			rule_id: 'R-DEADLINE-48H',
			severity: 'high',
			reason: 'Review deadline within 48 hours',
			suggested_action: 'Escalate to shift manager',
		}),
	},
	{
		rule_id: 'R-DEADLINE-PASSED',
		evaluate: (caseItem) => hoursLeft(caseItem) < 0,
		outcome: () => ({
			rule_id: 'R-DEADLINE-PASSED',
			severity: 'critical',
			reason: 'Review deadline passed',
			suggested_action: 'Immediate manager review required',
		}),
	},
];

export function evaluateRules(caseItem: ReviewCaseResponse): RuleOutcome[] {
	const outcomes: RuleOutcome[] = [];

	for (const rule of RULE_DEFINITIONS) {
		if (!rule.evaluate(caseItem)) {
			continue;
		}

		const base = rule.outcome();

		outcomes.push(
			'assigned_team' in base ? { kind: 'task', ...base } : { kind: 'escalation', ...base },
		);
	}

	return outcomes;
}

export function computeRiskLevel(caseItem: ReviewCaseResponse): Severity {
	let maxRank = SEVERITY_RANK.low;

	for (const task of caseItem.open_tasks ?? []) {
		maxRank = Math.max(maxRank, SEVERITY_RANK[task.severity]);
	}

	for (const escalation of caseItem.escalations) {
		if (escalation.status === 'active') {
			maxRank = Math.max(maxRank, SEVERITY_RANK[escalation.severity]);
		}
	}

	return (Object.entries(SEVERITY_RANK).find(([, rank]) => rank === maxRank)?.[0] ??
		'low') as Severity;
}

export interface ApplyRulesResult {
	tasksCreated: number;
	escalationsChanged: number;
	triggered: string[];
	createdTaskIds: string[];
	responseTasks: Array<{ rule_id: string; title: string; severity: Severity }>;
	responseEscalations: Array<{ rule_id: string; severity: Severity; reason: string }>;
}

export function applyRuleOutcomes(
	caseItem: ReviewCaseResponse,
	outcomes: RuleOutcome[],
	createTaskId: () => string,
): ApplyRulesResult {
	let tasksCreated = 0;
	let escalationsChanged = 0;
	const triggered: string[] = [];
	const createdTaskIds: string[] = [];
	const responseTasks: ApplyRulesResult['responseTasks'] = [];
	const responseEscalations: ApplyRulesResult['responseEscalations'] = [];

	for (const outcome of outcomes) {
		triggered.push(outcome.rule_id);

		if (outcome.kind === 'task') {
			const existing = (caseItem.open_tasks ?? []).find((task) => task.rule_id === outcome.rule_id);

			if (existing) {
				existing.title = outcome.title;

				existing.description = outcome.description;

				existing.severity = outcome.severity;

				existing.suggested_action = outcome.suggested_action;

				existing.assigned_team = outcome.assigned_team;

				existing.document_type = outcome.document_type;

				existing.due_date = caseItem.deadline;

				responseTasks.push({
					rule_id: outcome.rule_id,
					title: outcome.title,
					severity: outcome.severity,
				});

				continue;
			}

			const task: TaskDto = {
				id: createTaskId(),
				title: outcome.title,
				description: outcome.description,
				severity: outcome.severity,
				status: 'open',
				suggested_action: outcome.suggested_action,
				due_date: caseItem.deadline,
				assigned_team: outcome.assigned_team,
				assigned_user: caseItem.assigned_user,
				document_type: outcome.document_type,
				rule_id: outcome.rule_id,
			};

			(caseItem.open_tasks ??= []).push(task);

			tasksCreated += 1;

			createdTaskIds.push(task.id);

			responseTasks.push({
				rule_id: outcome.rule_id,
				title: outcome.title,
				severity: outcome.severity,
			});

			continue;
		}

		const activeDeadlineEscalation = caseItem.escalations.find(
			(escalation) => escalation.status === 'active',
		);

		if (
			activeDeadlineEscalation &&
			SEVERITY_RANK[activeDeadlineEscalation.severity] >= SEVERITY_RANK[outcome.severity]
		) {
			responseEscalations.push({
				rule_id: outcome.rule_id,
				severity: activeDeadlineEscalation.severity,
				reason: activeDeadlineEscalation.reason,
			});

			continue;
		}

		if (activeDeadlineEscalation) {
			activeDeadlineEscalation.status = 'resolved';

			escalationsChanged += 1;
		}

		const escalation: EscalationDto = {
			severity: outcome.severity,
			reason: outcome.reason,
			suggested_action: outcome.suggested_action,
			status: 'active',
		};

		caseItem.escalations.push(escalation);

		escalationsChanged += 1;

		responseEscalations.push({
			rule_id: outcome.rule_id,
			severity: outcome.severity,
			reason: outcome.reason,
		});
	}

	caseItem.risk_level = computeRiskLevel(caseItem);

	return {
		tasksCreated,
		escalationsChanged,
		triggered,
		createdTaskIds,
		responseTasks,
		responseEscalations,
	};
}

export const RULES_EVALUATED_COUNT = RULE_DEFINITIONS.length;
