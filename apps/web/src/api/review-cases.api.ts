import { api } from '@/lib/api';
import type {
	CreateReviewCaseRequest,
	ReviewCaseResponse,
	ReviewCasesQuery,
	ReviewCasesResponse,
} from '../types';

export function fetchReviewCases(query: ReviewCasesQuery = {}): Promise<ReviewCasesResponse> {
	const params = new URLSearchParams();

	if (query.status && query.status !== 'all') {
		params.set('status', query.status);
	}

	if (query.page) {
		params.set('page', String(query.page));
	}

	if (query.limit) {
		params.set('limit', String(query.limit));
	}

	const queryString = params.toString();

	return api.get(
		`/review-cases${queryString ? `?${queryString}` : ''}`,
	) as Promise<ReviewCasesResponse>;
}

export function createReviewCase(request: CreateReviewCaseRequest): Promise<ReviewCaseResponse> {
	return api.post('/review-cases', request) as Promise<ReviewCaseResponse>;
}
