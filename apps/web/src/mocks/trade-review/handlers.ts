import { http, HttpResponse } from 'msw';
import type { CreateReviewCaseRequest, WorkQueueQuery } from '@/types';
import {
	cancelCase,
	completeTask,
	createReviewCase,
	findCaseByReference,
	findTaskById,
	getAuditLog,
	getReviewCases,
	getWorkQueue,
	reassignCase,
	reassignTask,
	runRules,
} from './store';

const BASE = '/api';

function parseWorkQueueQuery(url: URL): WorkQueueQuery {
	const page = Number(url.searchParams.get('page') ?? '1');
	const limit = Number(url.searchParams.get('limit') ?? '20');

	return {
		assigned_team: url.searchParams.get('assigned_team') ?? undefined,
		assigned_user: url.searchParams.get('assigned_user') ?? undefined,
		deadline: (url.searchParams.get('deadline') as WorkQueueQuery['deadline']) ?? 'all',
		sort: (url.searchParams.get('sort') as WorkQueueQuery['sort']) ?? 'risk',
		page: Number.isFinite(page) ? page : 1,
		limit: Number.isFinite(limit) ? limit : 20,
	};
}

function parseReviewCasesQuery(url: URL) {
	const page = Number(url.searchParams.get('page') ?? '1');
	const limit = Number(url.searchParams.get('limit') ?? '20');
	const status = url.searchParams.get('status') ?? 'all';

	return {
		status: status as 'all' | 'open' | 'in_review' | 'completed' | 'cancelled',
		page: Number.isFinite(page) ? page : 1,
		limit: Number.isFinite(limit) ? limit : 20,
	};
}

export const tradeReviewHandlers = [
	http.get(`${BASE}/work-queue`, ({ request }) => {
		const url = new URL(request.url);

		return HttpResponse.json(getWorkQueue(parseWorkQueueQuery(url)));
	}),

	http.get(`${BASE}/review-cases`, ({ request }) => {
		const url = new URL(request.url);
		const query = parseReviewCasesQuery(url);

		if (query.page < 1 || query.limit < 1 || query.limit > 100) {
			return HttpResponse.json(
				{ error: { code: 'VALIDATION_ERROR', message: 'Invalid page or limit' } },
				{ status: 400 },
			);
		}

		return HttpResponse.json(getReviewCases(query));
	}),

	http.post(`${BASE}/review-cases`, async ({ request }) => {
		const actorId = request.headers.get('X-Actor-Id');

		if (!actorId?.trim()) {
			return HttpResponse.json(
				{ error: { code: 'UNAUTHORIZED', message: 'X-Actor-Id header is required' } },
				{ status: 401 },
			);
		}

		let body: CreateReviewCaseRequest;

		try {
			body = (await request.json()) as CreateReviewCaseRequest;
		} catch {
			return HttpResponse.json(
				{ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body' } },
				{ status: 400 },
			);
		}

		const result = createReviewCase(body, actorId.trim());

		if (result === 'DUPLICATE_REFERENCE') {
			return HttpResponse.json(
				{
					error: {
						code: 'DUPLICATE_REFERENCE',
						message: `Case reference ${body.case_reference} already exists`,
					},
				},
				{ status: 409 },
			);
		}

		if (result === 'VALIDATION_ERROR') {
			return HttpResponse.json(
				{ error: { code: 'VALIDATION_ERROR', message: 'Invalid review case payload' } },
				{ status: 400 },
			);
		}

		return HttpResponse.json(result, { status: 201 });
	}),

	http.get(`${BASE}/review-cases/:caseRef`, ({ params }) => {
		const caseRef = String(params.caseRef);
		const caseItem = findCaseByReference(caseRef);

		if (!caseItem) {
			return HttpResponse.json(
				{ error: { code: 'NOT_FOUND', message: `Case ${caseRef} not found` } },
				{ status: 404 },
			);
		}

		const { open_tasks: _openTasks, ...caseWithoutTasks } = caseItem;

		return HttpResponse.json({
			...caseWithoutTasks,
			escalations: caseItem.escalations,
		});
	}),

	http.get(`${BASE}/review-cases/:caseRef/tasks`, ({ params, request }) => {
		const caseRef = String(params.caseRef);
		const caseItem = findCaseByReference(caseRef);

		if (!caseItem) {
			return HttpResponse.json(
				{ error: { code: 'NOT_FOUND', message: `Case ${caseRef} not found` } },
				{ status: 404 },
			);
		}

		const status = new URL(request.url).searchParams.get('status');
		const tasks = caseItem.open_tasks ?? [];
		const filtered = status ? tasks.filter((task) => task.status === status) : tasks;

		return HttpResponse.json(filtered);
	}),

	http.get(`${BASE}/review-cases/:caseRef/tasks/:taskId`, ({ params }) => {
		const caseRef = String(params.caseRef);
		const taskId = String(params.taskId);
		const task = findTaskById(caseRef, taskId);

		if (!task) {
			return HttpResponse.json(
				{ error: { code: 'NOT_FOUND', message: `Task ${taskId} not found` } },
				{ status: 404 },
			);
		}

		return HttpResponse.json(task);
	}),

	http.get(`${BASE}/review-cases/:caseRef/audit-log`, ({ params }) => {
		const caseRef = String(params.caseRef);
		const caseItem = findCaseByReference(caseRef);

		if (!caseItem) {
			return HttpResponse.json(
				{ error: { code: 'NOT_FOUND', message: `Case ${caseRef} not found` } },
				{ status: 404 },
			);
		}

		const items = getAuditLog(caseRef);

		return HttpResponse.json({ total: items.length, items });
	}),

	http.post(`${BASE}/tasks/:taskId/complete`, async ({ params, request }) => {
		const taskId = String(params.taskId);
		const actorId = request.headers.get('X-Actor-Id');

		if (!actorId?.trim()) {
			return HttpResponse.json(
				{ error: { code: 'UNAUTHORIZED', message: 'X-Actor-Id header is required' } },
				{ status: 401 },
			);
		}

		let body: { resolution_comment?: string } = {};

		try {
			body = (await request.json()) as { resolution_comment?: string };
		} catch {
			body = {};
		}

		const result = completeTask(taskId, body.resolution_comment, actorId.trim());

		if (result === 'NOT_FOUND') {
			return HttpResponse.json(
				{ error: { code: 'NOT_FOUND', message: `Task ${taskId} not found` } },
				{ status: 404 },
			);
		}

		if (result === 'ALREADY_COMPLETED') {
			return HttpResponse.json(
				{ error: { code: 'ALREADY_COMPLETED', message: `Task ${taskId} is already completed` } },
				{ status: 409 },
			);
		}

		return HttpResponse.json(result);
	}),

	http.post(`${BASE}/tasks/:taskId/reassign`, async ({ params, request }) => {
		const taskId = String(params.taskId);
		const actorId = request.headers.get('X-Actor-Id');

		if (!actorId?.trim()) {
			return HttpResponse.json(
				{ error: { code: 'UNAUTHORIZED', message: 'X-Actor-Id header is required' } },
				{ status: 401 },
			);
		}

		let body: { assigned_team?: string; assigned_user?: string };

		try {
			body = (await request.json()) as { assigned_team?: string; assigned_user?: string };
		} catch {
			return HttpResponse.json(
				{ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body' } },
				{ status: 400 },
			);
		}

		const result = reassignTask(
			taskId,
			{
				assigned_team: body.assigned_team ?? '',
				assigned_user: body.assigned_user,
			},
			actorId.trim(),
		);

		if (result === 'NOT_FOUND') {
			return HttpResponse.json(
				{ error: { code: 'NOT_FOUND', message: `Task ${taskId} not found` } },
				{ status: 404 },
			);
		}

		if (result === 'VALIDATION_ERROR') {
			return HttpResponse.json(
				{ error: { code: 'VALIDATION_ERROR', message: 'assigned_team is required' } },
				{ status: 400 },
			);
		}

		return HttpResponse.json(result);
	}),

	http.post(`${BASE}/review-cases/:caseRef/reassign`, async ({ params, request }) => {
		const caseRef = String(params.caseRef);
		const actorId = request.headers.get('X-Actor-Id');

		if (!actorId?.trim()) {
			return HttpResponse.json(
				{ error: { code: 'UNAUTHORIZED', message: 'X-Actor-Id header is required' } },
				{ status: 401 },
			);
		}

		let body: { assigned_team?: string; assigned_user?: string };

		try {
			body = (await request.json()) as { assigned_team?: string; assigned_user?: string };
		} catch {
			return HttpResponse.json(
				{ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body' } },
				{ status: 400 },
			);
		}

		const result = reassignCase(
			caseRef,
			{
				assigned_team: body.assigned_team ?? '',
				assigned_user: body.assigned_user,
			},
			actorId.trim(),
		);

		if (result === 'NOT_FOUND') {
			return HttpResponse.json(
				{ error: { code: 'NOT_FOUND', message: `Case ${caseRef} not found` } },
				{ status: 404 },
			);
		}

		if (result === 'VALIDATION_ERROR') {
			return HttpResponse.json(
				{ error: { code: 'VALIDATION_ERROR', message: 'assigned_team is required' } },
				{ status: 400 },
			);
		}

		return HttpResponse.json(result);
	}),

	http.post(`${BASE}/review-cases/:caseRef/run-rules`, ({ params }) => {
		const caseRef = String(params.caseRef);
		const result = runRules(caseRef);

		if (result === 'NOT_FOUND') {
			return HttpResponse.json(
				{ error: { code: 'NOT_FOUND', message: `Case ${caseRef} not found` } },
				{ status: 404 },
			);
		}

		if (result === 'CASE_CANCELLED') {
			return HttpResponse.json(
				{
					error: {
						code: 'CASE_CANCELLED',
						message: `Cannot run rules on cancelled case ${caseRef}`,
					},
				},
				{ status: 409 },
			);
		}

		return HttpResponse.json(result);
	}),

	http.post(`${BASE}/review-cases/:caseRef/cancel`, async ({ params, request }) => {
		const caseRef = String(params.caseRef);
		const actorId = request.headers.get('X-Actor-Id');

		if (!actorId?.trim()) {
			return HttpResponse.json(
				{ error: { code: 'UNAUTHORIZED', message: 'X-Actor-Id header is required' } },
				{ status: 401 },
			);
		}

		let body: { reason?: string };

		try {
			body = (await request.json()) as { reason?: string };
		} catch {
			return HttpResponse.json(
				{ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body' } },
				{ status: 400 },
			);
		}

		const result = cancelCase(caseRef, body.reason ?? '', actorId.trim());

		if (result === 'NOT_FOUND') {
			return HttpResponse.json(
				{ error: { code: 'NOT_FOUND', message: `Case ${caseRef} not found` } },
				{ status: 404 },
			);
		}

		if (result === 'ALREADY_CANCELLED') {
			return HttpResponse.json(
				{
					error: {
						code: 'ALREADY_CANCELLED',
						message: `Case ${caseRef} is already cancelled`,
					},
				},
				{ status: 409 },
			);
		}

		if (result === 'VALIDATION_ERROR') {
			return HttpResponse.json(
				{ error: { code: 'VALIDATION_ERROR', message: 'Cancellation reason is required' } },
				{ status: 400 },
			);
		}

		return HttpResponse.json(result);
	}),
];
