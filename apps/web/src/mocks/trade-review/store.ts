import type {
	AuditLogEntry,
	CancelCaseResponse,
	CaseViewDto,
	CompleteTaskResponse,
	CreateReviewCaseRequest,
	ReassignCaseResponse,
	ReassignRequest,
	ReassignTaskResponse,
	ReviewCaseListItemDto,
	ReviewCaseResponse,
	ReviewCasesQuery,
	RunRulesResponse,
	Severity,
	TaskDto,
	WorkQueueQuery,
} from '@/types';
import { SEVERITY_RANK as severityRank } from '@/types/domain.types';
import { AUDIT_LOGS_FIXTURE, CASES_FIXTURE } from './fixtures';
import { applyRuleOutcomes, evaluateRules, RULES_EVALUATED_COUNT } from './rules-engine';

export interface TradeReviewMockStore {
	cases: ReviewCaseResponse[];
	auditLogs: Record<string, AuditLogEntry[]>;
	completedTaskIds: Set<string>;
}

function cloneFixture(): TradeReviewMockStore {
	return {
		cases: structuredClone(CASES_FIXTURE),
		auditLogs: structuredClone(AUDIT_LOGS_FIXTURE),
		completedTaskIds: new Set(),
	};
}

export const tradeReviewStore: TradeReviewMockStore = cloneFixture();

let nextCaseId = 200;
let nextTaskId = 1000;

export function resetTradeReviewStore(): void {
	const fresh = cloneFixture();

	tradeReviewStore.cases = fresh.cases;

	tradeReviewStore.auditLogs = fresh.auditLogs;

	tradeReviewStore.completedTaskIds = fresh.completedTaskIds;

	nextCaseId = 200;

	nextTaskId = 1000;
}

function createTaskId(): string {
	return `task-${nextTaskId++}`;
}

function toCaseViewDto(caseItem: ReviewCaseResponse): CaseViewDto {
	return {
		case_reference: caseItem.case_reference,
		shipment_reference: caseItem.shipment_reference,
		importer: caseItem.importer,
		status: caseItem.status,
		risk_level: caseItem.risk_level,
		deadline: caseItem.deadline,
		time_remaining_hours: caseItem.time_remaining_hours,
		open_tasks: (caseItem.open_tasks ?? []).map((task) => ({
			id: task.id,
			title: task.title,
			severity: task.severity,
			status: task.status,
			suggested_action: task.suggested_action,
		})),
		escalations: caseItem.escalations.map((escalation) => ({
			severity: escalation.severity,
			reason: escalation.reason,
			suggested_action: escalation.suggested_action,
		})),
	};
}

function matchesWorkQueueFilters(caseItem: ReviewCaseResponse, query: WorkQueueQuery): boolean {
	if (caseItem.status === 'cancelled' || caseItem.status === 'completed') {
		return false;
	}

	if (query.assigned_team) {
		if (caseItem.assigned_team.toLowerCase() !== query.assigned_team.toLowerCase()) {
			return false;
		}
	}

	if (query.assigned_user) {
		const caseUser = (caseItem.assigned_user ?? '').toLowerCase();

		if (caseUser !== query.assigned_user.toLowerCase()) {
			return false;
		}
	}

	const deadline = query.deadline ?? 'all';

	if (deadline === 'approaching') {
		if (caseItem.time_remaining_hours <= 0 || caseItem.time_remaining_hours >= 48) {
			return false;
		}
	}

	if (deadline === 'past' && caseItem.time_remaining_hours >= 0) {
		return false;
	}

	return true;
}

function sortWorkQueueCases(
	cases: ReviewCaseResponse[],
	sort: WorkQueueQuery['sort'],
): ReviewCaseResponse[] {
	const sorted = [...cases];
	const rank: Record<Severity, number> = severityRank;

	if (sort === 'deadline') {
		sorted.sort(
			(a, b) => a.deadline.localeCompare(b.deadline) || rank[b.risk_level] - rank[a.risk_level],
		);
	} else {
		sorted.sort(
			(a, b) => rank[b.risk_level] - rank[a.risk_level] || a.deadline.localeCompare(b.deadline),
		);
	}

	return sorted;
}

export function getWorkQueue(query: WorkQueueQuery = {}) {
	const page = Math.max(1, query.page ?? 1);
	const limit = Math.min(100, Math.max(1, query.limit ?? 20));

	const filtered = sortWorkQueueCases(
		tradeReviewStore.cases.filter((caseItem) => matchesWorkQueueFilters(caseItem, query)),
		query.sort ?? 'risk',
	);

	const total = filtered.length;
	const start = (page - 1) * limit;
	const items = filtered.slice(start, start + limit).map(toCaseViewDto);

	return { total, items };
}

function toReviewCaseListItem(caseItem: ReviewCaseResponse): ReviewCaseListItemDto {
	return {
		case_reference: caseItem.case_reference,
		shipment_reference: caseItem.shipment_reference,
		importer: caseItem.importer,
		status: caseItem.status,
		risk_level: caseItem.risk_level,
		deadline: caseItem.deadline,
		time_remaining_hours: caseItem.time_remaining_hours,
		escalations: caseItem.escalations
			.filter((escalation) => escalation.status === 'active')
			.map((escalation) => ({
				severity: escalation.severity,
				reason: escalation.reason,
			})),
		assigned_team: caseItem.assigned_team,
		assigned_user: caseItem.assigned_user,
	};
}

function matchesReviewCasesStatusFilter(
	caseItem: ReviewCaseResponse,
	status: ReviewCasesQuery['status'],
): boolean {
	if (!status || status === 'all') {
		return true;
	}

	return caseItem.status === status;
}

export function getReviewCases(query: ReviewCasesQuery = {}) {
	const page = Math.max(1, query.page ?? 1);
	const limit = Math.min(100, Math.max(1, query.limit ?? 20));
	const status = query.status ?? 'all';

	const filtered = tradeReviewStore.cases.filter((caseItem) =>
		matchesReviewCasesStatusFilter(caseItem, status),
	);

	const total = filtered.length;
	const start = (page - 1) * limit;
	const items = filtered.slice(start, start + limit).map(toReviewCaseListItem);

	return { total, items };
}

function addDaysToDate(dateStr: string, days: number): string {
	const date = new Date(`${dateStr}T12:00:00Z`);

	date.setUTCDate(date.getUTCDate() + days);

	return date.toISOString().slice(0, 10);
}

function computeTimeRemainingHours(deadline: string): number {
	const deadlineMs = new Date(`${deadline}T23:59:59Z`).getTime();

	return Math.round((deadlineMs - Date.now()) / 3_600_000);
}

function isSubset<T>(subset: T[], superset: T[]): boolean {
	const allowed = new Set(superset);

	return subset.every((item) => allowed.has(item));
}

export type CreateReviewCaseResult =
	| ReviewCaseResponse
	| 'DUPLICATE_REFERENCE'
	| 'VALIDATION_ERROR';

export function createReviewCase(
	request: CreateReviewCaseRequest,
	actorId: string,
): CreateReviewCaseResult {
	if (request.review_window_days <= 0) {
		return 'VALIDATION_ERROR';
	}

	if (!isSubset(request.completed_documents, request.required_documents)) {
		return 'VALIDATION_ERROR';
	}

	if (
		tradeReviewStore.cases.some((caseItem) => caseItem.case_reference === request.case_reference)
	) {
		return 'DUPLICATE_REFERENCE';
	}

	const now = new Date().toISOString();
	const deadline = addDaysToDate(request.arrival_date, request.review_window_days);
	const timeRemainingHours = computeTimeRemainingHours(deadline);

	const newCase: ReviewCaseResponse = {
		id: `case-${nextCaseId++}`,
		case_reference: request.case_reference,
		shipment_reference: request.shipment_reference,
		importer: request.importer,
		arrival_date: request.arrival_date,
		review_window_days: request.review_window_days,
		deadline,
		time_remaining_hours: timeRemainingHours,
		status: 'open',
		risk_level: 'low',
		invoice_value: request.invoice_value,
		packaging_type: request.packaging_type,
		ispm15_certified: request.ispm15_certified,
		required_documents: [...request.required_documents],
		completed_documents: [...request.completed_documents],
		assigned_team: request.assigned_team,
		assigned_user: request.assigned_user,
		created_at: now,
		updated_at: now,
		escalations: [],
		open_tasks: [],
	};

	tradeReviewStore.cases.push(newCase);

	const auditEntry: AuditLogEntry = {
		id: `al-${Date.now()}`,
		action: 'case_created',
		entity_type: 'case',
		summary: `Case ${request.case_reference} created`,
		actor: actorId,
		created_at: now,
		after: {
			case_reference: request.case_reference,
			status: 'open',
		},
	};

	if (!tradeReviewStore.auditLogs[request.case_reference]) {
		tradeReviewStore.auditLogs[request.case_reference] = [];
	}

	const caseAuditLogs = tradeReviewStore.auditLogs[request.case_reference];

	if (caseAuditLogs) {
		caseAuditLogs.push(auditEntry);
	}

	return newCase;
}

export function findCaseByReference(caseReference: string): ReviewCaseResponse | undefined {
	return tradeReviewStore.cases.find((caseItem) => caseItem.case_reference === caseReference);
}

export function findTaskById(caseReference: string, taskId: string) {
	const caseItem = findCaseByReference(caseReference);

	return caseItem?.open_tasks?.find((task) => task.id === taskId);
}

function findOpenTaskLocation(taskId: string):
	| {
			caseItem: ReviewCaseResponse;
			task: TaskDto;
			taskIndex: number;
	  }
	| undefined {
	for (const caseItem of tradeReviewStore.cases) {
		const openTasks = caseItem.open_tasks ?? [];
		const taskIndex = openTasks.findIndex((task) => task.id === taskId);

		if (taskIndex >= 0) {
			const task = openTasks[taskIndex];

			if (task) {
				return { caseItem, task, taskIndex };
			}
		}
	}

	return undefined;
}

export function completeTask(
	taskId: string,
	resolutionComment: string | undefined,
	actorId: string,
): CompleteTaskResponse | 'NOT_FOUND' | 'ALREADY_COMPLETED' {
	if (tradeReviewStore.completedTaskIds.has(taskId)) {
		return 'ALREADY_COMPLETED';
	}

	const location = findOpenTaskLocation(taskId);

	if (!location) {
		return 'NOT_FOUND';
	}

	const { caseItem, task, taskIndex } = location;

	if (task.status === 'completed') {
		return 'ALREADY_COMPLETED';
	}

	const trimmedComment = resolutionComment?.trim();
	const response: CompleteTaskResponse = {
		id: task.id,
		status: 'completed',
	};

	if (trimmedComment) {
		response.resolution_comment = trimmedComment;
	}

	if (task.document_type) {
		if (!caseItem.completed_documents.includes(task.document_type)) {
			caseItem.completed_documents.push(task.document_type);
		}

		response.document_completed = task.document_type;
	}

	(caseItem.open_tasks ?? []).splice(taskIndex, 1);

	tradeReviewStore.completedTaskIds.add(taskId);

	const now = new Date().toISOString();

	appendAuditEntry(caseItem.case_reference, {
		id: `al-${Date.now()}`,
		action: 'task_completed',
		entity_type: 'task',
		entity_id: task.id,
		summary: `Task completed: ${task.title}`,
		actor: actorId,
		created_at: now,
		before: { status: task.status },
		after: {
			status: 'completed',
			...(trimmedComment ? { resolution_comment: trimmedComment } : {}),
			...(response.document_completed ? { document_completed: response.document_completed } : {}),
		},
	});

	return response;
}

function appendAuditEntry(caseReference: string, entry: AuditLogEntry): void {
	if (!tradeReviewStore.auditLogs[caseReference]) {
		tradeReviewStore.auditLogs[caseReference] = [];
	}

	const caseAuditLogs = tradeReviewStore.auditLogs[caseReference];

	if (caseAuditLogs) {
		caseAuditLogs.push(entry);
	}
}

export function reassignTask(
	taskId: string,
	request: ReassignRequest,
	actorId: string,
): ReassignTaskResponse | 'NOT_FOUND' | 'VALIDATION_ERROR' {
	const team = request.assigned_team.trim();

	if (!team) {
		return 'VALIDATION_ERROR';
	}

	const location = findOpenTaskLocation(taskId);

	if (!location) {
		return 'NOT_FOUND';
	}

	const { caseItem, task } = location;
	const user = request.assigned_user?.trim() || undefined;
	const before = {
		assigned_team: task.assigned_team,
		...(task.assigned_user ? { assigned_user: task.assigned_user } : {}),
	};

	task.assigned_team = team;

	task.assigned_user = user;

	const now = new Date().toISOString();

	appendAuditEntry(caseItem.case_reference, {
		id: `al-${Date.now()}`,
		action: 'task_reassigned',
		entity_type: 'task',
		entity_id: task.id,
		summary: `Task reassigned to ${team}${user ? ` / ${user}` : ''}`,
		actor: actorId,
		created_at: now,
		before,
		after: {
			assigned_team: team,
			...(user ? { assigned_user: user } : {}),
		},
	});

	return { ...task };
}

export function reassignCase(
	caseReference: string,
	request: ReassignRequest,
	actorId: string,
): ReassignCaseResponse | 'NOT_FOUND' | 'VALIDATION_ERROR' {
	const team = request.assigned_team.trim();

	if (!team) {
		return 'VALIDATION_ERROR';
	}

	const caseItem = findCaseByReference(caseReference);

	if (!caseItem) {
		return 'NOT_FOUND';
	}

	const user = request.assigned_user?.trim() || undefined;
	const before = {
		assigned_team: caseItem.assigned_team,
		...(caseItem.assigned_user ? { assigned_user: caseItem.assigned_user } : {}),
	};

	caseItem.assigned_team = team;

	caseItem.assigned_user = user;

	caseItem.updated_at = new Date().toISOString();

	appendAuditEntry(caseReference, {
		id: `al-${Date.now()}`,
		action: 'case_reassigned',
		entity_type: 'case',
		summary: `Case reassigned to ${team}${user ? ` / ${user}` : ''}`,
		actor: actorId,
		created_at: caseItem.updated_at,
		before,
		after: {
			assigned_team: team,
			...(user ? { assigned_user: user } : {}),
		},
	});

	return {
		id: caseItem.id,
		case_reference: caseItem.case_reference,
		assigned_team: caseItem.assigned_team,
		assigned_user: caseItem.assigned_user,
		updated_at: caseItem.updated_at,
	};
}

export function getAuditLog(caseReference: string): AuditLogEntry[] {
	const logs = tradeReviewStore.auditLogs[caseReference];

	if (logs?.length) {
		return [...logs].sort((a, b) => a.created_at.localeCompare(b.created_at));
	}

	const caseItem = findCaseByReference(caseReference);

	return [
		{
			id: 'al-default',
			action: 'case_created',
			entity_type: 'case',
			summary: `Case ${caseReference} created`,
			actor: 'system',
			created_at: caseItem?.created_at ?? '2026-07-01T09:00:00Z',
			after: { case_reference: caseReference },
		},
	];
}

export type RunRulesResult = RunRulesResponse | 'NOT_FOUND' | 'CASE_CANCELLED';

export function runRules(caseReference: string): RunRulesResult {
	const caseItem = findCaseByReference(caseReference);

	if (!caseItem) {
		return 'NOT_FOUND';
	}

	if (caseItem.status === 'cancelled') {
		return 'CASE_CANCELLED';
	}

	const outcomes = evaluateRules(caseItem);
	const applied = applyRuleOutcomes(caseItem, outcomes, createTaskId);
	const now = new Date().toISOString();

	caseItem.updated_at = now;

	appendAuditEntry(caseReference, {
		id: `al-${Date.now()}-rules`,
		action: 'rules_executed',
		entity_type: 'case',
		summary: `Rules evaluated (${RULES_EVALUATED_COUNT} rules, ${applied.tasksCreated} tasks created)`,
		actor: 'system',
		created_at: now,
		after: {
			rules_evaluated: RULES_EVALUATED_COUNT,
			tasks_created: applied.tasksCreated,
			triggered: applied.triggered,
		},
	});

	for (const taskId of applied.createdTaskIds) {
		const task = (caseItem.open_tasks ?? []).find((openTask) => openTask.id === taskId);

		if (!task) {
			continue;
		}

		appendAuditEntry(caseReference, {
			id: `al-${Date.now()}-${task.id}`,
			action: 'task_created',
			entity_type: 'task',
			entity_id: task.id,
			summary: `Task created: ${task.title} (${task.severity})`,
			actor: 'system',
			created_at: now,
			after: { rule_id: task.rule_id, severity: task.severity },
		});
	}

	if (applied.escalationsChanged > 0) {
		const activeEscalation = caseItem.escalations.find(
			(escalation) => escalation.status === 'active',
		);

		if (activeEscalation) {
			appendAuditEntry(caseReference, {
				id: `al-${Date.now()}-esc`,
				action: 'escalation_changed',
				entity_type: 'escalation',
				summary: `Escalation created: ${activeEscalation.reason} (${activeEscalation.severity})`,
				actor: 'system',
				created_at: now,
				after: { change: 'created', severity: activeEscalation.severity },
			});
		}
	}

	return {
		risk_level: caseItem.risk_level,
		tasks: applied.responseTasks.length,
		escalations: applied.responseEscalations.length,
	};
}

export type CancelCaseResult =
	| CancelCaseResponse
	| 'NOT_FOUND'
	| 'ALREADY_CANCELLED'
	| 'VALIDATION_ERROR';

export function cancelCase(
	caseReference: string,
	reason: string,
	actorId: string,
): CancelCaseResult {
	const trimmedReason = reason.trim();

	if (!trimmedReason) {
		return 'VALIDATION_ERROR';
	}

	const caseItem = findCaseByReference(caseReference);

	if (!caseItem) {
		return 'NOT_FOUND';
	}

	if (caseItem.status === 'cancelled') {
		return 'ALREADY_CANCELLED';
	}

	const cancelledTasks = (caseItem.open_tasks ?? []).length;
	const previousStatus = caseItem.status;
	const now = new Date().toISOString();

	caseItem.status = 'cancelled';

	caseItem.open_tasks = [];

	caseItem.escalations = caseItem.escalations.map((escalation) =>
		escalation.status === 'active' ? { ...escalation, status: 'resolved' } : escalation,
	);

	caseItem.risk_level = 'low';

	caseItem.updated_at = now;

	appendAuditEntry(caseReference, {
		id: `al-${Date.now()}-cancel`,
		action: 'case_status_changed',
		entity_type: 'case',
		summary: `Case cancelled, reason: ${trimmedReason}`,
		actor: actorId,
		created_at: now,
		before: { status: previousStatus },
		after: { status: 'cancelled', reason: trimmedReason, cancelled_tasks: cancelledTasks },
	});

	return {
		id: caseItem.id,
		status: 'cancelled',
		cancelled_tasks: cancelledTasks,
	};
}

// Re-export for consumers that import rank from the store module.
export { severityRank as SEVERITY_RANK };
