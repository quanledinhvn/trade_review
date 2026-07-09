import { HttpStatus, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AUDIT_ACTION } from '../../src/domain/audit';
import { CASE_STATUS } from '../../src/domain/case-status';
import { TASK_STATUS } from '../../src/domain/task-status';
import { DOCUMENT_TYPE } from '../../src/domain/document-type';
import { ESCALATION_STATUS, RESOLVED_REASON } from '../../src/domain/escalation';
import { PrismaService } from '../../src/database/prisma.service';
import { canonicalCasePayload, seedInReviewCase, withActorHeaders } from '../utils';

describe('Task workflow (e2e)', () => {
	let server: Parameters<typeof request>[0];
	let app: INestApplication;
	let prisma: PrismaService;

	beforeAll(async () => {
		app = global.testContext.app;

		server = app.getHttpServer();

		prisma = app.get(PrismaService);
	});

	describe('GET /api/review-cases/:id/tasks', () => {
		it('returns all tasks sorted severity desc then due_date asc', async () => {
			const seeded = await seedInReviewCase(prisma);

			const response = await request(server).get(`/api/review-cases/${seeded.id}/tasks`);

			expect(response.status).toBe(HttpStatus.OK);

			expect(response.body).toHaveLength(4);

			expect(response.body[0].severity).toBe('critical');

			expect(response.body[0]).toMatchObject({
				case_id: seeded.id,
				rule_id: 'R-DOC-TRANSPORT',
				document_type: 'transport_document',
				status: 'open',
			});
		});

		it('filters by ?status=open', async () => {
			const seeded = await seedInReviewCase(prisma);

			const response = await request(server).get(
				`/api/review-cases/${seeded.id}/tasks?status=open`,
			);

			expect(response.status).toBe(HttpStatus.OK);

			expect(response.body.every((t: { status: string }) => t.status === 'open')).toBe(true);
		});

		it('returns 404 when case not found', async () => {
			const response = await request(server).get(
				'/api/review-cases/00000000-0000-7000-8000-000000000000/tasks',
			);

			expect(response.status).toBe(HttpStatus.NOT_FOUND);
		});
	});

	describe('POST /api/tasks/:id/complete', () => {
		it('completes task, syncs document_type to case completed_documents', async () => {
			const seeded = await seedInReviewCase(prisma, { ...canonicalCasePayload });

			const transport = seeded.tasks.find((task) => task.ruleId === 'R-DOC-TRANSPORT')!;

			const response = await request(server)
				.post(`/api/tasks/${transport.id}/complete`)
				.set('X-Actor-Id', 'bob')
				.set('X-Actor-Team', 'trade_operations')
				.send({ resolution_comment: 'Received B/L from carrier.' });

			expect(response.status).toBe(HttpStatus.OK);

			expect(response.body).toMatchObject({
				id: transport.id,
				status: 'completed',
				resolution_comment: 'Received B/L from carrier.',
				document_completed: 'transport_document',
			});

			const reviewCase = await prisma.reviewCase.findUnique({ where: { id: seeded.id } });

			expect(reviewCase!.completedDocuments).toContain('transport_document');
		});

		it('writes task_completed audit with document_completed in after', async () => {
			const seeded = await seedInReviewCase(prisma, { ...canonicalCasePayload });

			const transport = seeded.tasks.find((task) => task.ruleId === 'R-DOC-TRANSPORT')!;

			await request(server)
				.post(`/api/tasks/${transport.id}/complete`)
				.set('X-Actor-Id', 'bob')
				.set('X-Actor-Team', 'trade_operations')
				.send({ resolution_comment: 'B/L received' });

			const audit = await prisma.auditLog.findFirst({
				where: { caseId: seeded.id, action: AUDIT_ACTION.TASK_COMPLETED },
			});

			expect(audit).toMatchObject({
				action: AUDIT_ACTION.TASK_COMPLETED,
				actor: 'bob',
			});

			expect(audit?.after).toMatchObject({
				status: TASK_STATUS.COMPLETED,
				document_completed: DOCUMENT_TYPE.TRANSPORT_DOCUMENT,
			});
		});

		it('writes case_updated audit when risk_level rolls up after task complete', async () => {
			const seeded = await seedInReviewCase(
				prisma,
				{ ...canonicalCasePayload },
				{ deadlineHoursFromNow: 36 },
			);

			const transport = seeded.tasks.find((task) => task.ruleId === 'R-DOC-TRANSPORT')!;

			await request(server)
				.post(`/api/tasks/${transport.id}/complete`)
				.set('X-Actor-Id', 'bob')
				.set('X-Actor-Team', 'trade_operations')
				.send({ resolution_comment: 'B/L received' });

			const audit = await prisma.auditLog.findFirst({
				where: { caseId: seeded.id, action: AUDIT_ACTION.CASE_UPDATED },
			});

			expect(audit).toMatchObject({
				action: AUDIT_ACTION.CASE_UPDATED,
				actor: 'bob',
				before: { risk_level: 'critical' },
			});

			expect(audit?.after).toMatchObject({ risk_level: 'high' });
		});

		it('returns 409 when task already completed', async () => {
			const seeded = await seedInReviewCase(prisma, undefined, {
				taskOverrides: {
					'R-DOC-TRANSPORT': { status: TASK_STATUS.COMPLETED },
				},
			});

			const task = seeded.tasks.find((task) => task.ruleId === 'R-DOC-TRANSPORT')!;

			const response = await request(server)
				.post(`/api/tasks/${task.id}/complete`)
				.set('X-Actor-Id', 'bob')
				.set('X-Actor-Team', 'trade_operations')
				.send({});

			expect(response.status).toBe(HttpStatus.CONFLICT);
		});

		it('returns 400 when actor headers missing', async () => {
			const seeded = await seedInReviewCase(prisma);

			const task = seeded.tasks[0]!;

			const response = await request(server)
				.post(`/api/tasks/${task.id}/complete`)
				.send({ resolution_comment: 'no headers' });

			expect(response.status).toBe(HttpStatus.BAD_REQUEST);
		});

		it('returns 403 when actor team does not match task assigned_team', async () => {
			const seeded = await seedInReviewCase(prisma);

			const task = seeded.tasks[0]!;

			const response = await request(server)
				.post(`/api/tasks/${task.id}/complete`)
				.set('X-Actor-Id', 'carol')
				.set('X-Actor-Team', 'customs_brokerage')
				.send({});

			expect(response.status).toBe(HttpStatus.FORBIDDEN);
		});

		it('returns 403 when assigned_user set and actor id differs (team match not enough)', async () => {
			const seeded = await seedInReviewCase(prisma, undefined, {
				taskOverrides: {
					'R-DOC-TRANSPORT': { assignedUser: 'minh' },
				},
			});

			const task = seeded.tasks.find((task) => task.ruleId === 'R-DOC-TRANSPORT')!;

			const response = await request(server)
				.post(`/api/tasks/${task.id}/complete`)
				.set('X-Actor-Id', 'bob')
				.set('X-Actor-Team', 'trade_operations')
				.send({});

			expect(response.status).toBe(HttpStatus.FORBIDDEN);
		});

		it('returns 404 when task not found', async () => {
			const response = await request(server)
				.post('/api/tasks/00000000-0000-7000-8000-000000000000/complete')
				.set('X-Actor-Id', 'bob')
				.set('X-Actor-Team', 'trade_operations')
				.send({});

			expect(response.status).toBe(HttpStatus.NOT_FOUND);
		});
	});

	describe('POST /api/tasks/:id/reassign', () => {
		it('updates assigned_team and assigned_user', async () => {
			const seeded = await seedInReviewCase(prisma);

			const task = seeded.tasks[0]!;

			const response = await request(server)
				.post(`/api/tasks/${task.id}/reassign`)
				.set('X-Actor-Id', 'alice')
				.set('X-Actor-Team', 'trade_operations')
				.send({ assigned_team: 'customs_brokerage', assigned_user: 'carol' });

			expect(response.status).toBe(HttpStatus.OK);

			expect(response.body).toMatchObject({
				assigned_team: 'customs_brokerage',
				assigned_user: 'carol',
			});
		});

		it('writes task_reassigned audit with before/after team and user', async () => {
			const seeded = await seedInReviewCase(prisma);

			const task = seeded.tasks[0]!;

			await request(server)
				.post(`/api/tasks/${task.id}/reassign`)
				.set('X-Actor-Id', 'alice')
				.set('X-Actor-Team', 'trade_operations')
				.send({ assigned_team: 'customs_brokerage', assigned_user: 'carol' });

			const audit = await prisma.auditLog.findFirst({
				where: { caseId: seeded.id, action: AUDIT_ACTION.TASK_REASSIGNED },
			});

			expect(audit).toMatchObject({ actor: 'alice' });

			expect(audit?.before).toMatchObject({
				assigned_team: 'trade_operations',
				assigned_user: null,
			});

			expect(audit?.after).toMatchObject({
				assigned_team: 'customs_brokerage',
				assigned_user: 'carol',
			});
		});

		it('returns 403 when actor not on current assigned team', async () => {
			const seeded = await seedInReviewCase(prisma);

			const task = seeded.tasks[0]!;

			const response = await request(server)
				.post(`/api/tasks/${task.id}/reassign`)
				.set('X-Actor-Id', 'carol')
				.set('X-Actor-Team', 'customs_brokerage')
				.send({ assigned_team: 'customs_brokerage' });

			expect(response.status).toBe(HttpStatus.FORBIDDEN);
		});

		it('returns 400 when assigned_team missing', async () => {
			const seeded = await seedInReviewCase(prisma);

			const task = seeded.tasks[0]!;

			const response = await request(server)
				.post(`/api/tasks/${task.id}/reassign`)
				.set('X-Actor-Id', 'alice')
				.set('X-Actor-Team', 'trade_operations')
				.send({});

			expect(response.status).toBe(HttpStatus.BAD_REQUEST);
		});

		it('returns 404 when task not found', async () => {
			const response = await request(server)
				.post('/api/tasks/00000000-0000-7000-8000-000000000000/reassign')
				.set('X-Actor-Id', 'alice')
				.set('X-Actor-Team', 'trade_operations')
				.send({ assigned_team: 'customs_brokerage' });

			expect(response.status).toBe(HttpStatus.NOT_FOUND);
		});
	});

	it('complete transport doc then re-run rules does not recreate transport task', async () => {
		const seeded = await seedInReviewCase(prisma, { ...canonicalCasePayload });

		const transport = seeded.tasks.find((task) => task.ruleId === 'R-DOC-TRANSPORT')!;

		await request(server)
			.post(`/api/tasks/${transport.id}/complete`)
			.set('X-Actor-Id', 'bob')
			.set('X-Actor-Team', 'trade_operations')
			.send({ resolution_comment: 'B/L received' });

		const rerun = await withActorHeaders(
			request(server).post(`/api/review-cases/${seeded.id}/run-rules`),
		);

		expect(rerun.status).toBe(HttpStatus.OK);

		const tasks = await prisma.task.findMany({
			where: { caseId: seeded.id, ruleId: 'R-DOC-TRANSPORT' },
		});

		expect(tasks).toHaveLength(1);

		expect(tasks[0]!.status).toBe('completed');

		const reviewCase = await prisma.reviewCase.findUnique({ where: { id: seeded.id } });

		expect(reviewCase!.completedDocuments).toContain('transport_document');
	});

	it('marks case completed and resolves active escalations when all tasks are terminal', async () => {
		const seeded = await seedInReviewCase(
			prisma,
			{ ...canonicalCasePayload },
			{ deadlineHoursFromNow: 36 },
		);

		for (const task of seeded.tasks) {
			const response = await request(server)
				.post(`/api/tasks/${task.id}/complete`)
				.set('X-Actor-Id', 'bob')
				.set('X-Actor-Team', task.assignedTeam)
				.send({ resolution_comment: 'done' });

			expect(response.status).toBe(HttpStatus.OK);
		}

		const reviewCase = await prisma.reviewCase.findUniqueOrThrow({ where: { id: seeded.id } });

		expect(reviewCase.status).toBe(CASE_STATUS.COMPLETED);

		expect(reviewCase.riskLevel).toBe('low');

		const updatedAudits = await prisma.auditLog.findMany({
			where: { caseId: seeded.id, action: AUDIT_ACTION.CASE_UPDATED },
			orderBy: { createdAt: 'asc' },
		});

		const completionAudit = updatedAudits.find(
			(entry) => (entry.after as { status?: string })?.status === CASE_STATUS.COMPLETED,
		);

		expect(completionAudit).toMatchObject({
			action: AUDIT_ACTION.CASE_UPDATED,
			actor: 'bob',
			before: { status: CASE_STATUS.IN_REVIEW },
			after: { status: CASE_STATUS.COMPLETED },
		});

		const lastRiskAudit = [...updatedAudits]
			.reverse()
			.find((entry) => (entry.after as { risk_level?: string })?.risk_level === 'low');

		expect(lastRiskAudit?.after).toMatchObject({ risk_level: 'low' });

		const escalations = await prisma.escalation.findMany({ where: { caseId: seeded.id } });

		expect(
			escalations.every((escalation) => escalation.status === ESCALATION_STATUS.RESOLVED),
		).toBe(true);

		const resolvedEscalationAudits = await prisma.auditLog.findMany({
			where: { caseId: seeded.id, action: AUDIT_ACTION.ESCALATION_RESOLVED },
		});

		expect(resolvedEscalationAudits).toHaveLength(escalations.length);

		expect(resolvedEscalationAudits[0]).toMatchObject({
			action: AUDIT_ACTION.ESCALATION_RESOLVED,
			actor: 'bob',
			before: { status: ESCALATION_STATUS.ACTIVE },
			after: {
				status: ESCALATION_STATUS.RESOLVED,
				resolved_reason: RESOLVED_REASON.CASE_COMPLETED,
			},
		});

		const workQueue = await request(server).get('/api/work-queue');

		expect(workQueue.status).toBe(HttpStatus.OK);

		const refs = workQueue.body.items.map(
			(item: { case_reference: string }) => item.case_reference,
		);

		expect(refs).not.toContain(reviewCase.caseReference);
	});
});
