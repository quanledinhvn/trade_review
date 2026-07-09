import { api } from '@/lib/api';
import type { WorkQueueQuery, WorkQueueResponse } from '../types';

export function fetchWorkQueue(query: WorkQueueQuery = {}): Promise<WorkQueueResponse> {
	const params = new URLSearchParams();

	if (query.assigned_team) {
		params.set('assigned_team', query.assigned_team);
	}

	if (query.assigned_user) {
		params.set('assigned_user', query.assigned_user);
	}

	if (query.deadline && query.deadline !== 'all') {
		params.set('deadline', query.deadline);
	}

	if (query.sort) {
		params.set('sort', query.sort);
	}

	if (query.page) {
		params.set('page', String(query.page));
	}

	if (query.limit) {
		params.set('limit', String(query.limit));
	}

	const queryString = params.toString();

	return api.get(
		`/work-queue${queryString ? `?${queryString}` : ''}`,
	) as Promise<WorkQueueResponse>;
}
