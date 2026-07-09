import { describe, expect, it, beforeEach } from 'vitest';
import {
	cancelCase,
	completeTask,
	createReviewCase,
	findCaseByReference,
	getAuditLog,
	getReviewCases,
	getWorkQueue,
	reassignCase,
	reassignTask,
	resetTradeReviewStore,
	runRules,
} from './store';

describe('getWorkQueue', () => {
	beforeEach(() => {
		resetTradeReviewStore();
	});

	it('excludes cancelled and completed cases', () => {
		const result = getWorkQueue({ assigned_team: 'operation', limit: 20 });

		expect(result.items.some((item) => item.case_reference === 'REV-2026-0105')).toBe(false);

		expect(result.items.some((item) => item.case_reference === 'REV-2026-0098')).toBe(false);
	});

	it('filters by assigned team and user', () => {
		const result = getWorkQueue({
			assigned_team: 'operation',
			assigned_user: 'ryan',
			limit: 20,
		});

		expect(result.total).toBe(1);

		expect(result.items[0]?.case_reference).toBe('REV-2026-0142');
	});

	it('filters approaching deadline cases', () => {
		const result = getWorkQueue({
			deadline: 'approaching',
			limit: 20,
		});

		expect(result.items.every((item) => item.time_remaining_hours > 0)).toBe(true);

		expect(result.items.every((item) => item.time_remaining_hours < 48)).toBe(true);
	});

	it('sorts by risk descending by default', () => {
		const result = getWorkQueue({ limit: 20 });

		const ranks = result.items.map((item) => item.risk_level);

		expect(ranks.indexOf('critical')).toBeLessThan(ranks.indexOf('high'));
	});

	it('paginates results', () => {
		const page1 = getWorkQueue({ limit: 1, page: 1 });
		const page2 = getWorkQueue({ limit: 1, page: 2 });

		expect(page1.items).toHaveLength(1);

		expect(page2.items).toHaveLength(1);

		expect(page1.items[0]?.case_reference).not.toBe(page2.items[0]?.case_reference);
	});
});

describe('completeTask', () => {
	beforeEach(() => {
		resetTradeReviewStore();
	});

	it('marks a document task completed and updates case completed_documents', () => {
		const result = completeTask('task-119-1', 'Received B/L from carrier', 'ryan');

		expect(result).toEqual({
			id: 'task-119-1',
			status: 'completed',
			resolution_comment: 'Received B/L from carrier',
			document_completed: 'transport_document',
		});

		const caseItem = findCaseByReference('REV-2026-0119');

		expect(caseItem?.open_tasks?.some((task) => task.id === 'task-119-1')).toBe(false);

		expect(caseItem?.completed_documents).toContain('transport_document');
	});

	it('removes completed task from work queue open tasks', () => {
		completeTask('task-142-1', undefined, 'ryan');

		const workQueue = getWorkQueue({ assigned_team: 'operation', assigned_user: 'ryan' });
		const caseView = workQueue.items.find((item) => item.case_reference === 'REV-2026-0142');

		expect(caseView?.open_tasks.some((task) => task.id === 'task-142-1')).toBe(false);
	});

	it('returns ALREADY_COMPLETED when completing the same task twice', () => {
		const first = completeTask('task-120-1', undefined, 'ryan');
		const second = completeTask('task-120-1', undefined, 'ryan');

		expect(first).toMatchObject({ id: 'task-120-1', status: 'completed' });

		expect(second).toBe('ALREADY_COMPLETED');
	});

	it('appends a task_completed audit entry', () => {
		const beforeCount = getAuditLog('REV-2026-0119').length;

		completeTask('task-119-1', 'Received B/L from carrier', 'ryan');

		const logs = getAuditLog('REV-2026-0119');

		expect(logs).toHaveLength(beforeCount + 1);

		const latest = logs[logs.length - 1];

		expect(latest).toMatchObject({
			action: 'task_completed',
			entity_type: 'task',
			entity_id: 'task-119-1',
			actor: 'ryan',
			after: {
				status: 'completed',
				resolution_comment: 'Received B/L from carrier',
				document_completed: 'transport_document',
			},
		});
	});
});

describe('getReviewCases', () => {
	beforeEach(() => {
		resetTradeReviewStore();
	});

	it('includes cancelled and completed cases', () => {
		const result = getReviewCases({ limit: 20 });

		expect(result.items.some((item) => item.case_reference === 'REV-2026-0105')).toBe(true);

		expect(result.items.some((item) => item.case_reference === 'REV-2026-0098')).toBe(true);
	});

	it('filters by status', () => {
		const result = getReviewCases({ status: 'cancelled', limit: 20 });

		expect(result.total).toBe(1);

		expect(result.items[0]?.case_reference).toBe('REV-2026-0098');
	});

	it('returns only active escalations in list items', () => {
		const result = getReviewCases({ status: 'in_review', limit: 20 });
		const caseItem = result.items.find((item) => item.case_reference === 'REV-2026-0119');

		expect(caseItem?.escalations).toEqual([
			{ severity: 'high', reason: 'Review deadline within 48 hours' },
		]);
	});

	it('paginates results', () => {
		const page1 = getReviewCases({ limit: 2, page: 1 });
		const page2 = getReviewCases({ limit: 2, page: 2 });

		expect(page1.items).toHaveLength(2);

		expect(page2.items).toHaveLength(2);

		expect(page1.items[0]?.case_reference).not.toBe(page2.items[0]?.case_reference);
	});
});

describe('createReviewCase', () => {
	beforeEach(() => {
		resetTradeReviewStore();
	});

	it('creates a case without tasks or escalations', () => {
		const result = createReviewCase(
			{
				case_reference: 'REV-2026-0999',
				shipment_reference: 'SAF-TIME-2026-0999',
				importer: 'Test Importer',
				arrival_date: '2026-07-05',
				review_window_days: 7,
				invoice_value: 50000,
				packaging_type: 'pallet_generic',
				ispm15_certified: true,
				required_documents: ['commercial_invoice', 'packing_list', 'transport_document'],
				completed_documents: [],
				assigned_team: 'operation',
			},
			'ryan',
		);

		expect(result).toMatchObject({
			case_reference: 'REV-2026-0999',
			status: 'open',
			risk_level: 'low',
			open_tasks: [],
			escalations: [],
		});

		const listed = getReviewCases({ status: 'open', limit: 20 });

		expect(listed.items.some((item) => item.case_reference === 'REV-2026-0999')).toBe(true);
	});

	it('returns DUPLICATE_REFERENCE for an existing case reference', () => {
		const result = createReviewCase(
			{
				case_reference: 'REV-2026-0119',
				shipment_reference: 'SAF-TIME-2026-0998',
				importer: 'Duplicate',
				arrival_date: '2026-07-05',
				review_window_days: 7,
				invoice_value: 1000,
				packaging_type: 'pallet_generic',
				ispm15_certified: true,
				required_documents: ['commercial_invoice'],
				completed_documents: [],
				assigned_team: 'operation',
			},
			'ryan',
		);

		expect(result).toBe('DUPLICATE_REFERENCE');
	});
});

describe('getAuditLog', () => {
	beforeEach(() => {
		resetTradeReviewStore();
	});

	it('returns seeded audit entries for the canonical case sorted oldest first', () => {
		const logs = getAuditLog('REV-2026-0119');

		expect(logs.length).toBeGreaterThan(1);

		expect(logs[0]?.action).toBe('case_created');

		expect(logs.at(-1)?.action).toBe('task_reassigned');

		for (let index = 1; index < logs.length; index += 1) {
			const previous = logs[index - 1];
			const current = logs[index];

			if (previous && current) {
				expect(previous.created_at.localeCompare(current.created_at)).toBeLessThanOrEqual(0);
			}
		}
	});

	it('returns a default case_created entry for cases without explicit logs', () => {
		const logs = getAuditLog('REV-2026-0105');

		expect(logs).toEqual([
			{
				id: 'al-default',
				action: 'case_created',
				entity_type: 'case',
				summary: 'Case REV-2026-0105 created',
				actor: 'system',
				created_at: '2026-07-01T09:00:00Z',
				after: { case_reference: 'REV-2026-0105' },
			},
		]);
	});

	it('records reassignment mutations in the audit log', () => {
		reassignCase(
			'REV-2026-0142',
			{ assigned_team: 'trade_operations', assigned_user: 'minh' },
			'ryan',
		);

		const logs = getAuditLog('REV-2026-0142');

		expect(logs.at(-1)).toMatchObject({
			action: 'case_reassigned',
			actor: 'ryan',
			before: { assigned_team: 'operation', assigned_user: 'ryan' },
			after: { assigned_team: 'trade_operations', assigned_user: 'minh' },
		});
	});

	it('records task reassignment mutations in the audit log', () => {
		reassignTask(
			'task-142-1',
			{ assigned_team: 'trade_operations', assigned_user: 'minh' },
			'ryan',
		);

		const logs = getAuditLog('REV-2026-0142');

		expect(logs.at(-1)).toMatchObject({
			action: 'task_reassigned',
			entity_id: 'task-142-1',
			actor: 'ryan',
		});
	});
});

describe('runRules', () => {
	beforeEach(() => {
		resetTradeReviewStore();
	});

	it('re-runs rules idempotently on the canonical REV-2026-0119 fixture', () => {
		const result = runRules('REV-2026-0119');

		expect(result).toMatchObject({
			case_reference: 'REV-2026-0119',
			risk_level: 'critical',
			rules_evaluated: 7,
		});

		if (typeof result === 'string') {
			throw new Error('Expected runRules response object');
		}

		expect(result.tasks).toEqual(
			expect.arrayContaining([
				{
					rule_id: 'R-DOC-TRANSPORT',
					title: 'Missing transport document',
					severity: 'critical',
				},
				{
					rule_id: 'R-DOC-PACKING',
					title: 'Missing packing list',
					severity: 'high',
				},
				{
					rule_id: 'R-WOOD-ISPM15',
					title: 'Wood packaging — ISPM-15 certification',
					severity: 'high',
				},
			]),
		);

		expect(result.escalations).toEqual([
			{
				rule_id: 'R-DEADLINE-48H',
				severity: 'high',
				reason: 'Review deadline within 48 hours',
			},
		]);

		const caseItem = findCaseByReference('REV-2026-0119');

		expect(caseItem?.open_tasks).toHaveLength(3);

		expect(
			caseItem?.escalations.filter((escalation) => escalation.status === 'active'),
		).toHaveLength(1);
	});

	it('creates tasks and escalations for a newly created case', () => {
		createReviewCase(
			{
				case_reference: 'REV-2026-0999',
				shipment_reference: 'SAF-TIME-2026-0999',
				importer: 'Test Importer',
				arrival_date: '2026-07-05',
				review_window_days: 7,
				invoice_value: 50000,
				packaging_type: 'wooden_crate',
				ispm15_certified: false,
				required_documents: ['commercial_invoice', 'packing_list', 'transport_document'],
				completed_documents: ['commercial_invoice'],
				assigned_team: 'trade_operations',
			},
			'ryan',
		);

		const result = runRules('REV-2026-0999');

		if (typeof result === 'string') {
			throw new Error('Expected runRules response object');
		}

		expect(result.tasks).toBeGreaterThanOrEqual(3);

		expect(result.risk_level).toBe('critical');

		const logs = getAuditLog('REV-2026-0999');

		expect(logs.some((entry) => entry.action === 'rules_executed')).toBe(true);

		expect(logs.some((entry) => entry.action === 'task_created')).toBe(true);
	});

	it('returns CASE_CANCELLED for cancelled cases', () => {
		expect(runRules('REV-2026-0098')).toBe('CASE_CANCELLED');
	});

	it('appends rules_executed audit entry without duplicating tasks', () => {
		const beforeCount = getAuditLog('REV-2026-0119').length;
		const first = runRules('REV-2026-0119');
		const second = runRules('REV-2026-0119');

		if (typeof first === 'string' || typeof second === 'string') {
			throw new Error('Expected runRules response object');
		}

		expect(first.tasks).toHaveLength(3);

		expect(second.tasks).toHaveLength(3);

		const logs = getAuditLog('REV-2026-0119');

		expect(logs).toHaveLength(beforeCount + 2);

		expect(logs.filter((entry) => entry.action === 'rules_executed')).toHaveLength(3);
	});
});

describe('cancelCase', () => {
	beforeEach(() => {
		resetTradeReviewStore();
	});

	it('cancels a case, cascades open tasks, and removes it from the work queue', () => {
		const result = cancelCase('REV-2026-0119', 'Duplicate entry', 'ryan');

		expect(result).toEqual({
			id: 'case-119',
			status: 'cancelled',
			cancelled_tasks: 3,
		});

		const caseItem = findCaseByReference('REV-2026-0119');

		expect(caseItem?.status).toBe('cancelled');

		expect(caseItem?.open_tasks).toHaveLength(0);

		const workQueue = getWorkQueue({ limit: 20 });

		expect(workQueue.items.some((item) => item.case_reference === 'REV-2026-0119')).toBe(false);

		const reviewCases = getReviewCases({ status: 'cancelled', limit: 20 });

		expect(reviewCases.items.some((item) => item.case_reference === 'REV-2026-0119')).toBe(true);
	});

	it('records a case_status_changed audit entry with the reason', () => {
		cancelCase('REV-2026-0142', 'Entered in error', 'ryan');

		const logs = getAuditLog('REV-2026-0142');

		expect(logs.at(-1)).toMatchObject({
			action: 'case_status_changed',
			actor: 'ryan',
			after: {
				status: 'cancelled',
				reason: 'Entered in error',
				cancelled_tasks: 1,
			},
		});
	});

	it('returns ALREADY_CANCELLED when cancelling twice', () => {
		const first = cancelCase('REV-2026-0098', 'Again', 'ryan');
		const second = cancelCase('REV-2026-0098', 'Again', 'ryan');

		expect(first).toBe('ALREADY_CANCELLED');

		expect(second).toBe('ALREADY_CANCELLED');
	});

	it('returns VALIDATION_ERROR when reason is blank', () => {
		expect(cancelCase('REV-2026-0142', '   ', 'ryan')).toBe('VALIDATION_ERROR');
	});
});
