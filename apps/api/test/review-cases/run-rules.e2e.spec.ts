import { HttpStatus, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AUDIT_ACTION } from '../../src/domain/audit';
import { CASE_STATUS } from '../../src/domain/case-status';
import { RISK_LEVEL } from '../../src/domain/severity';
import { TASK_STATUS } from '../../src/domain/task-status';
import { DOCUMENT_TYPE } from '../../src/domain/document-type';
import { ESCALATION_STATUS, ESCALATION_TYPE } from '../../src/domain/escalation';
import { PACKAGING_TYPE } from '../../src/domain/packaging';
import type { ErrorDto } from '../../src/common/exceptions/exception';
import { PrismaService } from '../../src/database/prisma.service';
import type { RunRulesResponseDto } from '../../src/modules/review-cases/dto/run-rules-response.dto';
import { canonicalCasePayload, createCase, withActorHeaders } from '../utils';

describe('POST /api/review-cases/:id/run-rules (e2e)', () => {
	let server: Parameters<typeof request>[0];
	let app: INestApplication;
	let prisma: PrismaService;

	beforeAll(async () => {
		app = global.testContext.app;

		server = app.getHttpServer();

		prisma = app.get(PrismaService);
	});

	it('matches the canonical REV-2026-0119 fixture: 4 tasks + 1 escalation, risk_level critical', async () => {
		const created = await createCase(
			prisma,
			{ case_reference: 'REV-2026-0119', ...canonicalCasePayload },
			{ deadlineHoursFromNow: 36 },
		);

		const response = await withActorHeaders(
			request(server).post(`/api/review-cases/${created.id}/run-rules`),
		);
		const body = response.body as RunRulesResponseDto;

		expect(response.status).toBe(HttpStatus.OK);

		expect(body.risk_level).toBe(RISK_LEVEL.CRITICAL);

		expect(body.tasks).toBe(4);

		expect(body.escalations).toBe(1);

		const reviewCase = await prisma.reviewCase.findUniqueOrThrow({ where: { id: created.id } });

		expect(reviewCase.status).toBe(CASE_STATUS.IN_REVIEW);

		const tasks = await prisma.task.findMany({ where: { caseId: created.id } });

		expect(tasks).toHaveLength(4);

		const ruleIds = tasks.map((task) => task.ruleId);

		expect(ruleIds).toEqual(
			expect.arrayContaining(['R-DOC-PACKING', 'R-DOC-TRANSPORT', 'R-WOOD-ISPM15', 'R-HIGH-VALUE']),
		);

		expect(ruleIds).not.toContain('R-DOC-INVOICE');

		const transportTask = tasks.find((task) => task.ruleId === 'R-DOC-TRANSPORT');

		expect(transportTask).toMatchObject({
			severity: RISK_LEVEL.CRITICAL,
			status: TASK_STATUS.OPEN,
			suggestedAction: 'Request transport document from partner',
			assignedTeam: 'trade_operations',
			documentType: DOCUMENT_TYPE.TRANSPORT_DOCUMENT,
			reason: 'transport_document is required but not completed',
		});

		const highValueTask = tasks.find((task) => task.ruleId === 'R-HIGH-VALUE');

		expect(highValueTask).toMatchObject({
			severity: RISK_LEVEL.HIGH,
			assignedTeam: 'management',
			documentType: null,
		});

		const escalations = await prisma.escalation.findMany({ where: { caseId: created.id } });

		expect(escalations).toHaveLength(1);

		expect(escalations[0]).toMatchObject({
			ruleId: 'R-DEADLINE-48H',
			type: ESCALATION_TYPE.DEADLINE,
			severity: RISK_LEVEL.HIGH,
			status: ESCALATION_STATUS.ACTIVE,
		});

		const statusAudits = await prisma.auditLog.findMany({
			where: { caseId: created.id, action: AUDIT_ACTION.CASE_UPDATED },
		});

		expect(statusAudits).toHaveLength(1);

		expect(statusAudits[0]).toMatchObject({
			action: AUDIT_ACTION.CASE_UPDATED,
			before: { status: CASE_STATUS.OPEN },
			after: { status: CASE_STATUS.IN_REVIEW },
		});
	});

	it('is idempotent: re-running produces the same 4 tasks + 1 escalation, no duplicate audit rows', async () => {
		const created = await createCase(
			prisma,
			{ case_reference: 'REV-2026-0119-RERUN', ...canonicalCasePayload },
			{ deadlineHoursFromNow: 36 },
		);

		await withActorHeaders(request(server).post(`/api/review-cases/${created.id}/run-rules`));

		const second = await withActorHeaders(
			request(server).post(`/api/review-cases/${created.id}/run-rules`),
		);
		const body = second.body as RunRulesResponseDto;

		expect(second.status).toBe(HttpStatus.OK);

		expect(body.tasks).toBe(4);

		expect(body.escalations).toBe(1);

		expect(body.risk_level).toBe(RISK_LEVEL.CRITICAL);

		const tasks = await prisma.task.findMany({ where: { caseId: created.id } });

		expect(tasks).toHaveLength(4);

		const escalations = await prisma.escalation.findMany({ where: { caseId: created.id } });

		expect(escalations).toHaveLength(1);

		const taskCreatedAudits = await prisma.auditLog.findMany({
			where: { caseId: created.id, action: AUDIT_ACTION.TASK_CREATED },
		});

		expect(taskCreatedAudits).toHaveLength(4);

		const escalationCreatedAudits = await prisma.auditLog.findMany({
			where: { caseId: created.id, action: AUDIT_ACTION.ESCALATION_CREATED },
		});

		expect(escalationCreatedAudits).toHaveLength(1);

		const rulesExecutedAudits = await prisma.auditLog.findMany({
			where: { caseId: created.id, action: AUDIT_ACTION.RULES_EXECUTED },
		});

		expect(rulesExecutedAudits).toHaveLength(2);

		const statusAudits = await prisma.auditLog.findMany({
			where: { caseId: created.id, action: AUDIT_ACTION.CASE_UPDATED },
		});

		expect(statusAudits).toHaveLength(1);
	});

	it('does not fire R-DOC-INVOICE when commercial_invoice is completed, and no tasks when nothing matches', async () => {
		const created = await createCase(prisma, {
			case_reference: 'REV-2026-0119-NOMATCH',
			arrival_date: '2026-07-09',
			review_window_days: 7,
			required_documents: [DOCUMENT_TYPE.COMMERCIAL_INVOICE],
			completed_documents: [DOCUMENT_TYPE.COMMERCIAL_INVOICE],
			packaging_type: PACKAGING_TYPE.PLASTIC_BOX,
			ispm15_certified: true,
			invoice_value: 500,
		});

		const response = await withActorHeaders(
			request(server).post(`/api/review-cases/${created.id}/run-rules`),
		);
		const body = response.body as RunRulesResponseDto;

		expect(response.status).toBe(HttpStatus.OK);

		expect(body.tasks).toBe(0);

		expect(body.escalations).toBe(0);

		expect(body.risk_level).toBe(RISK_LEVEL.LOW);

		const reviewCase = await prisma.reviewCase.findUniqueOrThrow({ where: { id: created.id } });

		expect(reviewCase.status).toBe(CASE_STATUS.COMPLETED);

		const statusAudits = await prisma.auditLog.findMany({
			where: { caseId: created.id, action: AUDIT_ACTION.CASE_UPDATED },
		});

		expect(statusAudits).toHaveLength(1);

		expect(statusAudits[0]).toMatchObject({
			before: { status: CASE_STATUS.OPEN },
			after: { status: CASE_STATUS.COMPLETED },
		});
	});

	it('does not fire R-WOOD-ISPM15 for reconstituted_wood_box (processed wood, ISPM-15 exempt)', async () => {
		const created = await createCase(prisma, {
			case_reference: 'REV-2026-0119-RECON',
			required_documents: [DOCUMENT_TYPE.COMMERCIAL_INVOICE, DOCUMENT_TYPE.PACKING_LIST],
			completed_documents: [DOCUMENT_TYPE.COMMERCIAL_INVOICE, DOCUMENT_TYPE.PACKING_LIST],
			packaging_type: PACKAGING_TYPE.RECONSTITUTED_WOOD_BOX,
			ispm15_certified: false,
			invoice_value: 500,
			arrival_date: '2026-07-09',
			review_window_days: 14,
		});

		const response = await withActorHeaders(
			request(server).post(`/api/review-cases/${created.id}/run-rules`),
		);
		const body = response.body as RunRulesResponseDto;

		expect(response.status).toBe(HttpStatus.OK);

		expect(body.tasks).toBe(0);

		expect(body.escalations).toBe(0);

		expect(body.risk_level).toBe(RISK_LEVEL.LOW);

		const tasks = await prisma.task.findMany({ where: { caseId: created.id } });

		expect(tasks.map((task) => task.ruleId)).not.toContain('R-WOOD-ISPM15');

		const reviewCase = await prisma.reviewCase.findUniqueOrThrow({ where: { id: created.id } });

		expect(reviewCase.status).toBe(CASE_STATUS.COMPLETED);
	});

	it('returns 404 when the case does not exist', async () => {
		const response = await withActorHeaders(
			request(server).post('/api/review-cases/01940000-0000-7000-8000-000000000001/run-rules'),
		);
		const body = response.body as ErrorDto;

		expect(response.status).toBe(HttpStatus.NOT_FOUND);

		expect(body.error.code).toBe('NOT_FOUND');
	});

	it('returns 409 when the case is completed', async () => {
		const created = await createCase(
			prisma,
			{ case_reference: 'REV-2026-0119-COMPLETED' },
			{ status: CASE_STATUS.COMPLETED },
		);

		const response = await withActorHeaders(
			request(server).post(`/api/review-cases/${created.id}/run-rules`),
		);
		const body = response.body as ErrorDto;

		expect(response.status).toBe(HttpStatus.CONFLICT);

		expect(body.error.code).toBe('CONFLICT');
	});
});
