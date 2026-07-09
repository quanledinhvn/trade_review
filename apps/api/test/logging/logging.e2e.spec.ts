import { HttpStatus, type INestApplication } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import request from 'supertest';

function isAccessLogPayload(value: unknown): value is { message: string } {
	return typeof value === 'object' && value !== null && 'message' in value;
}

describe('Logging (e2e)', () => {
	let server: Parameters<typeof request>[0];

	beforeAll(async () => {
		const app: INestApplication = global.testContext.app;

		server = app.getHttpServer();
	});

	it('GET /api/health returns x-request-id', async () => {
		const response = await request(server).get('/api/health');

		expect(response.status).toBe(HttpStatus.OK);

		expect(response.headers['x-request-id']).toBeDefined();

		expect(typeof response.headers['x-request-id']).toBe('string');
	});

	it('echoes client x-request-id', async () => {
		const response = await request(server).get('/api/health').set('x-request-id', 'custom-id');

		expect(response.status).toBe(HttpStatus.OK);

		expect(response.headers['x-request-id']).toBe('custom-id');
	});

	it('GET /api/not-found returns x-request-id', async () => {
		const response = await request(server).get('/api/not-found');

		expect(response.status).toBe(HttpStatus.NOT_FOUND);

		expect(response.headers['x-request-id']).toBeDefined();
	});

	it('logs access for non-health routes', async () => {
		const logger = global.testContext.module.get(WINSTON_MODULE_PROVIDER);
		const warnSpy = jest.spyOn(logger, 'warn');

		await request(server).get('/api/not-found');

		expect(warnSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				message: 'HTTP access',
				http: expect.objectContaining({
					statusCode: 404,
					method: 'GET',
				}),
			}),
		);

		warnSpy.mockRestore();
	});

	it('skips access log for health', async () => {
		const logger = global.testContext.module.get(WINSTON_MODULE_PROVIDER);
		const infoSpy = jest.spyOn(logger, 'info');
		const warnSpy = jest.spyOn(logger, 'warn');
		const errorSpy = jest.spyOn(logger, 'error');

		await request(server).get('/api/health');

		const accessLogs = [...infoSpy.mock.calls, ...warnSpy.mock.calls, ...errorSpy.mock.calls]
			.map(([payload]) => payload)
			.filter(isAccessLogPayload)
			.filter((payload) => payload.message === 'HTTP access');

		expect(accessLogs).toHaveLength(0);

		infoSpy.mockRestore();

		warnSpy.mockRestore();

		errorSpy.mockRestore();
	});
});
