import { HttpStatus, type INestApplication } from '@nestjs/common';
import request from 'supertest';

describe('GET /api/health (e2e)', () => {
	let server: Parameters<typeof request>[0];

	beforeAll(async () => {
		const app: INestApplication = global.testContext.app;

		server = app.getHttpServer();
	});

	it('returns status ok', async () => {
		const response = await request(server).get('/api/health');

		expect(response.status).toBe(HttpStatus.OK);

		expect(response.body).toMatchObject({ status: 'ok' });

		expect(typeof response.body.uptimeSeconds).toBe('number');
	});
});
