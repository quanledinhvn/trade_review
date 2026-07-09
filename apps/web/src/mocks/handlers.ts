import { http, HttpResponse } from 'msw';
import { tradeReviewHandlers } from '@/mocks/trade-review/handlers';

const BASE = '/api';

interface HealthResponse {
	status: 'ok';
	uptimeSeconds: number;
	timestamp: string;
}

export const handlers = [
	http.get(`${BASE}/health`, () => {
		const body: HealthResponse = {
			status: 'ok',
			uptimeSeconds: 42,
			timestamp: new Date().toISOString(),
		};

		return HttpResponse.json(body);
	}),
	...tradeReviewHandlers,
];
