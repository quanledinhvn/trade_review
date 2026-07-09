import { api } from '@/lib/api';
import type { ReviewCaseDetail, RunRulesResponse, TaskDto } from '../types';

export function fetchReviewCase(caseRef: string): Promise<ReviewCaseDetail> {
	return api.get(`/review-cases/${encodeURIComponent(caseRef)}`) as Promise<ReviewCaseDetail>;
}

export function fetchCaseTasks(caseRef: string, status?: string): Promise<TaskDto[]> {
	const params = status ? `?status=${encodeURIComponent(status)}` : '';

	return api.get(`/review-cases/${encodeURIComponent(caseRef)}/tasks${params}`) as Promise<
		TaskDto[]
	>;
}

export function runCaseRules(caseRef: string): Promise<RunRulesResponse> {
	return api.post(
		`/review-cases/${encodeURIComponent(caseRef)}/run-rules`,
	) as Promise<RunRulesResponse>;
}
