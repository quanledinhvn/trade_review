import { HttpStatus, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AUDIT_ACTION } from '../../src/domain/audit';
import { CASE_STATUS } from '../../src/domain/case-status';
import { SEVERITY_LEVEL, SEVERITY_RANK } from '../../src/domain/severity';
import { AUDIT_ENTITY_TYPE } from '../../src/domain/audit';
import { DOCUMENT_TYPE } from '../../src/domain/document-type';
import type { ReviewCaseResponseDto } from '../../src/modules/review-cases/dto/review-case-response.dto';
import type { ErrorDto } from '../../src/common/exceptions/exception';
import { PrismaService } from '../../src/database/prisma.service';
import { validCreatePayload, withActorHeaders } from '../utils';

describe('POST /api/review-cases (e2e)', () => {
	let app: INestApplication;
	let server: Parameters<typeof request>[0];

	beforeAll(async () => {
		app = global.testContext.app;

		server = app.getHttpServer();
	});

	it('creates a case with computed deadline and defaults', async () => {
		const response = await withActorHeaders(request(server).post('/api/review-cases'), {
			actorId: 'minh',
		}).send(validCreatePayload);

		const body = response.body as ReviewCaseResponseDto;

		expect(response.status).toBe(HttpStatus.CREATED);

		expect(body).toMatchObject({
			case_reference: 'REV-2026-TEST-001',
			deadline: '2026-07-08',
			status: CASE_STATUS.OPEN,
			risk_level: SEVERITY_LEVEL.LOW,
			risk_rank: SEVERITY_RANK.low,
			assigned_team: 'trade_operations',
		});

		expect(body.id).toBeDefined();

		const prisma = app.get(PrismaService);
		const audit = await prisma.auditLog.findFirst({
			where: { caseId: body.id, action: AUDIT_ACTION.CASE_CREATED },
		});

		expect(audit).not.toBeNull();

		expect(audit?.actor).toBe('minh');

		expect(audit?.entityType).toBe(AUDIT_ENTITY_TYPE.CASE);
	});

	it('returns 400 when completed_documents is not a subset of required_documents', async () => {
		const response = await withActorHeaders(request(server).post('/api/review-cases'), {
			actorId: 'minh',
		}).send({
			...validCreatePayload,
			case_reference: 'REV-2026-TEST-400',
			completed_documents: [DOCUMENT_TYPE.TRANSPORT_DOCUMENT],
			required_documents: [DOCUMENT_TYPE.COMMERCIAL_INVOICE],
		});

		const body = response.body as ErrorDto;

		expect(response.status).toBe(HttpStatus.BAD_REQUEST);

		expect(body.error).toMatchObject({ code: 'VALIDATION_ERROR' });
	});

	it('returns 400 for invalid packaging_type enum', async () => {
		const response = await withActorHeaders(request(server).post('/api/review-cases'), {
			actorId: 'minh',
		}).send({
			...validCreatePayload,
			case_reference: 'REV-2026-TEST-400B',
			packaging_type: 'wooden crates',
		});

		const body = response.body as ErrorDto;

		expect(response.status).toBe(HttpStatus.BAD_REQUEST);

		expect(body.error.code).toBe('VALIDATION_ERROR');
	});

	it('returns 400 when review_window_days is not positive', async () => {
		const response = await withActorHeaders(request(server).post('/api/review-cases'), {
			actorId: 'minh',
		}).send({
			...validCreatePayload,
			case_reference: 'REV-2026-TEST-400C',
			review_window_days: 0,
		});

		const body = response.body as ErrorDto;

		expect(response.status).toBe(HttpStatus.BAD_REQUEST);

		expect(body.error.code).toBe('VALIDATION_ERROR');
	});

	it('returns 409 when case_reference already exists', async () => {
		await withActorHeaders(request(server).post('/api/review-cases'), { actorId: 'minh' }).send(
			validCreatePayload,
		);

		const response = await withActorHeaders(request(server).post('/api/review-cases'), {
			actorId: 'minh',
		}).send(validCreatePayload);

		const body = response.body as ErrorDto;

		expect(response.status).toBe(HttpStatus.CONFLICT);

		expect(body.error).toMatchObject({ code: 'CONFLICT' });
	});
});
