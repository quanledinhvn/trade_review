import { HttpStatus, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { CASE_STATUS } from '../../src/domain/case-status';
import { RISK_LEVEL, SEVERITY_RANK } from '../../src/domain/severity';
import type { ReviewCaseResponseDto } from '../../src/modules/review-cases/dto/review-case-response.dto';
import type { ErrorDto } from '../../src/common/exceptions/exception';
import { validCreatePayload, withActorHeaders } from '../utils';

describe('GET /api/review-cases/:id (e2e)', () => {
	let server: Parameters<typeof request>[0];

	beforeAll(async () => {
		const app: INestApplication = global.testContext.app;

		server = app.getHttpServer();
	});

	it('returns the full case with time_remaining_hours', async () => {
		const created = await withActorHeaders(
			request(server).post('/api/review-cases'),
			{ actorId: 'minh' },
		).send(validCreatePayload);

		const createdBody = created.body as ReviewCaseResponseDto;

		const response = await request(server).get(`/api/review-cases/${createdBody.id}`);
		const body = response.body as ReviewCaseResponseDto;

		expect(response.status).toBe(HttpStatus.OK);

		expect(body).toMatchObject({
			id: createdBody.id,
			case_reference: 'REV-2026-TEST-001',
			deadline: '2026-07-08',
			status: CASE_STATUS.OPEN,
			risk_level: RISK_LEVEL.LOW,
			risk_rank: SEVERITY_RANK.low,
		});

		expect(typeof (body as unknown as { time_remaining_hours: number }).time_remaining_hours).toBe(
			'number',
		);
	});

	it('returns 404 when the case does not exist', async () => {
		const response = await request(server).get(
			'/api/review-cases/01940000-0000-7000-8000-000000000001',
		);

		const body = response.body as ErrorDto;

		expect(response.status).toBe(HttpStatus.NOT_FOUND);

		expect(body.error.code).toBe('NOT_FOUND');
	});
});
