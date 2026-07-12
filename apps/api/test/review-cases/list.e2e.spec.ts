import { HttpStatus, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { SEVERITY_LEVEL } from '../../src/domain/severity';
import { ESCALATION_STATUS } from '../../src/domain/escalation';
import { PrismaService } from '../../src/database/prisma.service';
import type { ReviewCasesResponseDto } from '../../src/modules/review-cases/dto/review-cases-response.dto';
import { seedInReviewCase, validCreatePayload, withActorHeaders } from '../utils';

describe('GET /api/review-cases (e2e)', () => {
	let server: Parameters<typeof request>[0];
	let prisma: PrismaService;

	beforeAll(async () => {
		const app: INestApplication = global.testContext.app;

		server = app.getHttpServer();

		prisma = app.get(PrismaService);
	});

	it('returns paginated ReviewCaseListItemDto items', async () => {
		await seedInReviewCase(prisma, { case_reference: 'REV-LIST-001' });

		const response = await request(server).get('/api/review-cases');

		expect(response.status).toBe(HttpStatus.OK);

		const body = response.body as ReviewCasesResponseDto;

		expect(body).toMatchObject({
			total: expect.any(Number),
			items: expect.any(Array),
		});

		expect(body.total).toBeGreaterThanOrEqual(1);

		expect(body.items[0]).toMatchObject({
			case_reference: expect.any(String),
			shipment_reference: expect.any(String),
			importer: expect.any(String),
			status: expect.any(String),
			risk_level: expect.any(String),
			deadline: expect.any(String),
			time_remaining_hours: expect.any(Number),
			escalations: expect.any(Array),
			assigned_team: expect.any(String),
		});
	});

	it('filters by status', async () => {
		await withActorHeaders(request(server).post('/api/review-cases'), {
			actorId: 'minh',
		}).send({
			...validCreatePayload,
			case_reference: 'REV-LIST-OPEN',
		});

		await seedInReviewCase(prisma, { case_reference: 'REV-LIST-IN-REVIEW' });

		const openResponse = await request(server).get('/api/review-cases?status=open');
		const inReviewResponse = await request(server).get('/api/review-cases?status=in_review');

		expect(openResponse.status).toBe(HttpStatus.OK);

		expect(inReviewResponse.status).toBe(HttpStatus.OK);

		const openRefs = (openResponse.body as ReviewCasesResponseDto).items.map(
			(item) => item.case_reference,
		);
		const inReviewRefs = (inReviewResponse.body as ReviewCasesResponseDto).items.map(
			(item) => item.case_reference,
		);

		expect(openRefs).toContain('REV-LIST-OPEN');

		expect(openRefs).not.toContain('REV-LIST-IN-REVIEW');

		expect(inReviewRefs).toContain('REV-LIST-IN-REVIEW');

		expect(inReviewRefs).not.toContain('REV-LIST-OPEN');
	});

	it('paginates results', async () => {
		await withActorHeaders(request(server).post('/api/review-cases'), {
			actorId: 'minh',
		}).send({
			...validCreatePayload,
			case_reference: 'REV-LIST-PAGE-1',
		});

		await withActorHeaders(request(server).post('/api/review-cases'), {
			actorId: 'minh',
		}).send({
			...validCreatePayload,
			case_reference: 'REV-LIST-PAGE-2',
			shipment_reference: 'SAF-TIME-2026-PAGE-2',
		});

		const page1 = await request(server).get('/api/review-cases?limit=1&page=1');
		const page2 = await request(server).get('/api/review-cases?limit=1&page=2');

		expect(page1.status).toBe(HttpStatus.OK);

		expect(page2.status).toBe(HttpStatus.OK);

		const body1 = page1.body as ReviewCasesResponseDto;
		const body2 = page2.body as ReviewCasesResponseDto;

		expect(body1.total).toBeGreaterThanOrEqual(2);

		expect(body1.items).toHaveLength(1);

		expect(body2.items).toHaveLength(1);

		expect(body1.items[0]!.case_reference).not.toBe(body2.items[0]!.case_reference);
	});

	it('includes only active escalations', async () => {
		const seeded = await seedInReviewCase(prisma, { case_reference: 'REV-LIST-ESC' });

		const activeEscalation = seeded.escalations.find(
			(escalation) => escalation.status === ESCALATION_STATUS.ACTIVE,
		);

		expect(activeEscalation).toBeDefined();

		await prisma.escalation.create({
			data: {
				id: '019f46a7-2229-7029-8f25-list-esc-resolved',
				caseId: seeded.id,
				ruleId: 'deadline_approaching',
				type: 'deadline',
				severity: SEVERITY_LEVEL.MEDIUM,
				reason: 'Resolved escalation',
				suggestedAction: 'Done',
				status: ESCALATION_STATUS.RESOLVED,
				resolvedReason: 'manual',
				ruleSnapshot: {},
			},
		});

		const response = await request(server).get('/api/review-cases?status=in_review');

		expect(response.status).toBe(HttpStatus.OK);

		const item = (response.body as ReviewCasesResponseDto).items.find(
			(caseItem) => caseItem.case_reference === 'REV-LIST-ESC',
		);

		expect(item).toBeDefined();

		expect(item?.escalations).toEqual([
			{
				severity: activeEscalation!.severity,
				reason: activeEscalation!.reason,
			},
		]);
	});

	it('returns empty list for cancelled status filter', async () => {
		await seedInReviewCase(prisma, { case_reference: 'REV-LIST-NOT-CANCELLED' });

		const response = await request(server).get('/api/review-cases?status=cancelled');

		expect(response.status).toBe(HttpStatus.OK);

		expect(response.body).toMatchObject({
			total: 0,
			items: [],
		});
	});

	it('returns all statuses when status filter is omitted', async () => {
		await withActorHeaders(request(server).post('/api/review-cases'), {
			actorId: 'minh',
		}).send({
			...validCreatePayload,
			case_reference: 'REV-LIST-ALL-OPEN',
		});

		await seedInReviewCase(prisma, { case_reference: 'REV-LIST-ALL-IN-REVIEW' });

		const response = await request(server).get('/api/review-cases');

		expect(response.status).toBe(HttpStatus.OK);

		const refs = (response.body as ReviewCasesResponseDto).items.map((item) => item.case_reference);

		expect(refs).toContain('REV-LIST-ALL-OPEN');

		expect(refs).toContain('REV-LIST-ALL-IN-REVIEW');
	});
});
