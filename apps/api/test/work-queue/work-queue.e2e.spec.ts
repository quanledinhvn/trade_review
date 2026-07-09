import { HttpStatus, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { CASE_STATUS } from '../../src/domain/case-status';
import { RISK_LEVEL } from '../../src/domain/severity';
import { ESCALATION_STATUS, RESOLVED_REASON } from '../../src/domain/escalation';
import { PrismaService } from '../../src/database/prisma.service';
import { canonicalCasePayload, cleanCasePayload, createCase, seedInReviewCase } from '../utils';

describe('GET /api/work-queue (e2e)', () => {
	let server: Parameters<typeof request>[0];
	let app: INestApplication;
	let prisma: PrismaService;

	beforeAll(async () => {
		app = global.testContext.app;

		server = app.getHttpServer();

		prisma = app.get(PrismaService);
	});

	it('returns paginated CaseViewDto items', async () => {
		await seedInReviewCase(prisma, { case_reference: 'REV-WQ-001' });

		const response = await request(server).get('/api/work-queue');

		expect(response.status).toBe(HttpStatus.OK);

		expect(response.body).toMatchObject({
			total: expect.any(Number),
			items: expect.any(Array),
		});

		expect(response.body.total).toBeGreaterThanOrEqual(1);

		expect(response.body.items[0]).toHaveProperty('case_reference');

		expect(response.body.items[0]).toHaveProperty('open_tasks');

		expect(response.body.items[0]).toHaveProperty('escalations');
	});

	it('default sort by risk (critical first), tie-break by nearest deadline', async () => {
		await seedInReviewCase(
			prisma,
			{ case_reference: 'REV-WQ-LOW', ...cleanCasePayload },
			{ deadlineHoursFromNow: 120 },
		);

		await seedInReviewCase(prisma, { case_reference: 'REV-WQ-HIGH', ...canonicalCasePayload });

		const response = await request(server).get('/api/work-queue?sort=risk');

		expect(response.status).toBe(HttpStatus.OK);

		const refs = response.body.items.map((item: { case_reference: string }) => item.case_reference);
		const highIndex = refs.indexOf('REV-WQ-HIGH');
		const lowIndex = refs.indexOf('REV-WQ-LOW');

		expect(highIndex).toBeGreaterThanOrEqual(0);

		expect(lowIndex).toBeGreaterThanOrEqual(0);

		expect(highIndex).toBeLessThan(lowIndex);
	});

	it('deadline=approaching filters cases with 0 ≤ hours left < 48', async () => {
		await seedInReviewCase(
			prisma,
			{ case_reference: 'REV-WQ-APPROACH' },
			{ deadlineHoursFromNow: 36 },
		);

		await seedInReviewCase(prisma, { case_reference: 'REV-WQ-FAR' }, { deadlineHoursFromNow: 120 });

		const response = await request(server).get('/api/work-queue?deadline=approaching');

		expect(response.status).toBe(HttpStatus.OK);

		const refs = response.body.items.map((item: { case_reference: string }) => item.case_reference);

		expect(refs).toContain('REV-WQ-APPROACH');

		expect(refs).not.toContain('REV-WQ-FAR');
	});

	it('deadline=past filters overdue cases', async () => {
		await seedInReviewCase(
			prisma,
			{ case_reference: 'REV-WQ-PAST' },
			{ deadlineHoursFromNow: -12 },
		);

		await seedInReviewCase(
			prisma,
			{ case_reference: 'REV-WQ-FUTURE' },
			{ deadlineHoursFromNow: 72 },
		);

		const response = await request(server).get('/api/work-queue?deadline=past');

		expect(response.status).toBe(HttpStatus.OK);

		const refs = response.body.items.map((item: { case_reference: string }) => item.case_reference);

		expect(refs).toContain('REV-WQ-PAST');

		expect(refs).not.toContain('REV-WQ-FUTURE');
	});

	it('assigned_team filter works', async () => {
		await seedInReviewCase(prisma, {
			case_reference: 'REV-WQ-TEAM-A',
			assigned_team: 'trade_operations',
		});

		await seedInReviewCase(prisma, {
			case_reference: 'REV-WQ-TEAM-B',
			assigned_team: 'customs_brokerage',
		});

		const response = await request(server).get('/api/work-queue?assigned_team=customs_brokerage');

		expect(response.status).toBe(HttpStatus.OK);

		const refs = response.body.items.map((item: { case_reference: string }) => item.case_reference);

		expect(refs).toContain('REV-WQ-TEAM-B');

		expect(refs).not.toContain('REV-WQ-TEAM-A');
	});

	it('open cases never appear until run-rules moves them to in_review', async () => {
		const openOnly = await createCase(prisma, { case_reference: 'REV-WQ-OPEN-ONLY' });

		await seedInReviewCase(prisma, { case_reference: 'REV-WQ-IN-REVIEW' });

		const response = await request(server).get('/api/work-queue');

		expect(response.status).toBe(HttpStatus.OK);

		const refs = response.body.items.map((item: { case_reference: string }) => item.case_reference);

		expect(refs).toContain('REV-WQ-IN-REVIEW');

		expect(refs).not.toContain('REV-WQ-OPEN-ONLY');

		expect(await prisma.reviewCase.findUniqueOrThrow({ where: { id: openOnly.id } })).toMatchObject(
			{
				status: CASE_STATUS.OPEN,
			},
		);
	});

	it('completed cases never appear', async () => {
		await seedInReviewCase(prisma, { case_reference: 'REV-WQ-OPEN' });

		await createCase(prisma, { case_reference: 'REV-WQ-DONE' }, { status: CASE_STATUS.COMPLETED });

		const response = await request(server).get('/api/work-queue');

		expect(response.status).toBe(HttpStatus.OK);

		const refs = response.body.items.map((item: { case_reference: string }) => item.case_reference);

		expect(refs).toContain('REV-WQ-OPEN');

		expect(refs).not.toContain('REV-WQ-DONE');
	});

	it('open tasks within each case sorted by severity then due date', async () => {
		await seedInReviewCase(prisma, {
			case_reference: 'REV-WQ-TASK-SORT',
			...canonicalCasePayload,
		});

		const response = await request(server).get('/api/work-queue');

		expect(response.status).toBe(HttpStatus.OK);

		const item = response.body.items.find(
			(i: { case_reference: string }) => i.case_reference === 'REV-WQ-TASK-SORT',
		);

		expect(item).toBeDefined();

		expect(item.open_tasks[0].severity).toBe(RISK_LEVEL.CRITICAL);
	});

	it('only active escalations included in items', async () => {
		await seedInReviewCase(
			prisma,
			{
				case_reference: 'REV-WQ-ESC',
				...canonicalCasePayload,
			},
			{
				deadlineHoursFromNow: 36,
				escalationOverrides: {
					'R-DEADLINE-48H': {
						status: ESCALATION_STATUS.RESOLVED,
						resolvedAt: new Date(),
						resolvedReason: RESOLVED_REASON.CASE_COMPLETED,
					},
				},
			},
		);

		const response = await request(server).get('/api/work-queue');

		expect(response.status).toBe(HttpStatus.OK);

		const item = response.body.items.find(
			(i: { case_reference: string }) => i.case_reference === 'REV-WQ-ESC',
		);

		expect(item?.escalations ?? []).toHaveLength(0);
	});

	it('pagination returns correct page slice', async () => {
		for (let i = 1; i <= 3; i += 1) {
			await seedInReviewCase(prisma, { case_reference: `REV-WQ-PAGE-${i}` });
		}

		const response = await request(server).get('/api/work-queue?page=1&limit=2');

		expect(response.status).toBe(HttpStatus.OK);

		expect(response.body.items).toHaveLength(2);

		expect(response.body.total).toBeGreaterThanOrEqual(3);
	});

	it('returns 400 for invalid limit', async () => {
		const response = await request(server).get('/api/work-queue?limit=101');

		expect(response.status).toBe(HttpStatus.BAD_REQUEST);
	});

	it('REV-2026-0119 item shape matches Expected Work Queue Output after run-rules', async () => {
		await seedInReviewCase(
			prisma,
			{
				case_reference: 'REV-2026-0119',
				...canonicalCasePayload,
			},
			{ deadlineHoursFromNow: 36 },
		);

		const response = await request(server).get('/api/work-queue?assigned_team=trade_operations');

		expect(response.status).toBe(HttpStatus.OK);

		const item = response.body.items.find(
			(i: { case_reference: string }) => i.case_reference === 'REV-2026-0119',
		);

		expect(item).toMatchObject({
			case_reference: 'REV-2026-0119',
			risk_level: RISK_LEVEL.CRITICAL,
			time_remaining_hours: expect.any(Number),
		});

		expect(item.time_remaining_hours).toBeGreaterThanOrEqual(0);

		expect(item.time_remaining_hours).toBeLessThan(48);

		expect(item.open_tasks).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					title: 'Missing transport document',
					severity: RISK_LEVEL.CRITICAL,
					status: 'open',
					suggested_action: 'Request transport document from partner',
				}),
			]),
		);

		expect(item.escalations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					severity: RISK_LEVEL.HIGH,
					reason: 'Review deadline within 48 hours',
				}),
			]),
		);
	});
});
