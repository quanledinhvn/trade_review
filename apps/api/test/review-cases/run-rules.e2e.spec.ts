import { HttpStatus, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AUDIT_ACTION } from '../../src/domain/audit';
import { CASE_STATUS } from '../../src/domain/case-status';
import { SEVERITY_LEVEL } from '../../src/domain/severity';
import { TASK_STATUS } from '../../src/domain/task-status';
import { DOCUMENT_TYPE } from '../../src/domain/document-type';
import { ESCALATION_STATUS, ESCALATION_TYPE, RESOLVED_REASON } from '../../src/domain/escalation';
import { PACKAGING_TYPE } from '../../src/domain/packaging';
import type { ErrorDto } from '../../src/common/exceptions/exception';
import { PrismaService } from '../../src/database/prisma.service';
import type { RunRulesResponseDto } from '../../src/modules/review-cases/dto/run-rules-response.dto';
import { canonicalCasePayload, cleanCasePayload, createCase, withActorHeaders } from '../utils';

/**
 * A case with one missing document (a high-severity task) so it stays in_review after run-rules.
 * Completion is task-driven, so a deadline escalation is only raised while outstanding task work
 * remains — a lone deadline signal on an otherwise-clean case just completes.
 */
const taskCasePayload = {
	required_documents: [DOCUMENT_TYPE.COMMERCIAL_INVOICE, DOCUMENT_TYPE.PACKING_LIST],
	completed_documents: [DOCUMENT_TYPE.COMMERCIAL_INVOICE],
	packaging_type: PACKAGING_TYPE.PLASTIC_BOX,
	ispm15_certified: true,
	invoice_value: 500,
};

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

		expect(body.risk_level).toBe(SEVERITY_LEVEL.CRITICAL);

		expect(body.results).toHaveLength(5);

		const taskResults = body.results.filter((result) => result.task !== null);

		expect(taskResults).toHaveLength(4);

		const escalationResults = body.results.filter((result) => result.escalation !== null);

		expect(escalationResults).toHaveLength(1);

		expect(escalationResults[0]).toMatchObject({
			rule_id: 'R-DEADLINE-48H',
			trigger_reason: 'Review deadline within 48 hours',
			severity: SEVERITY_LEVEL.HIGH,
			suggested_action: 'Escalate to shift manager',
		});

		const reviewCase = await prisma.reviewCase.findUniqueOrThrow({ where: { id: created.id } });

		// active tasks remain, so run-rules transitions the case open -> in_review.
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
			severity: SEVERITY_LEVEL.CRITICAL,
			status: TASK_STATUS.OPEN,
			suggestedAction: 'Request transport document from partner',
			assignedTeam: 'trade_operations',
			documentType: DOCUMENT_TYPE.TRANSPORT_DOCUMENT,
			reason: 'transport_document is required but not completed',
		});

		const highValueTask = tasks.find((task) => task.ruleId === 'R-HIGH-VALUE');

		expect(highValueTask).toMatchObject({
			severity: SEVERITY_LEVEL.HIGH,
			assignedTeam: 'management',
			documentType: null,
		});

		const escalations = await prisma.escalation.findMany({ where: { caseId: created.id } });

		expect(escalations).toHaveLength(1);

		expect(escalations[0]).toMatchObject({
			ruleId: 'R-DEADLINE-48H',
			type: ESCALATION_TYPE.DEADLINE,
			severity: SEVERITY_LEVEL.HIGH,
			status: ESCALATION_STATUS.ACTIVE,
		});

		// run-rules folds the case change into a single RULES_EXECUTED audit; it never writes CASE_UPDATED.
		const statusAudits = await prisma.auditLog.findMany({
			where: { caseId: created.id, action: AUDIT_ACTION.CASE_UPDATED },
		});

		expect(statusAudits).toHaveLength(0);

		const rulesExecutedAudits = await prisma.auditLog.findMany({
			where: { caseId: created.id, action: AUDIT_ACTION.RULES_EXECUTED },
		});

		expect(rulesExecutedAudits).toHaveLength(1);

		expect(rulesExecutedAudits[0]?.after).toMatchObject({
			matched_rules: expect.arrayContaining([
				'R-DOC-PACKING',
				'R-DOC-TRANSPORT',
				'R-WOOD-ISPM15',
				'R-HIGH-VALUE',
				'R-DEADLINE-48H',
			]),
			created_rule_ids: expect.arrayContaining([
				'R-DOC-PACKING',
				'R-DOC-TRANSPORT',
				'R-WOOD-ISPM15',
				'R-HIGH-VALUE',
				'R-DEADLINE-48H',
			]),
			risk_level: SEVERITY_LEVEL.CRITICAL,
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

		expect(body.results).toHaveLength(0);

		expect(body.risk_level).toBe(SEVERITY_LEVEL.CRITICAL);

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

		expect(statusAudits).toHaveLength(0);
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

		expect(body.results).toHaveLength(0);

		expect(body.risk_level).toBe(SEVERITY_LEVEL.LOW);

		const reviewCase = await prisma.reviewCase.findUniqueOrThrow({ where: { id: created.id } });

		expect(reviewCase.status).toBe(CASE_STATUS.COMPLETED);

		// Completion is recorded only via RULES_EXECUTED; run-rules never writes CASE_UPDATED.
		const statusAudits = await prisma.auditLog.findMany({
			where: { caseId: created.id, action: AUDIT_ACTION.CASE_UPDATED },
		});

		expect(statusAudits).toHaveLength(0);

		const rulesExecutedAudits = await prisma.auditLog.findMany({
			where: { caseId: created.id, action: AUDIT_ACTION.RULES_EXECUTED },
		});

		expect(rulesExecutedAudits).toHaveLength(1);

		// risk_level stays low (unchanged), so it is not written into the audit after-image.
		expect(rulesExecutedAudits[0]?.after).toMatchObject({
			matched_rules: [],
			created_rule_ids: [],
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

		expect(body.results).toHaveLength(0);

		expect(body.risk_level).toBe(SEVERITY_LEVEL.LOW);

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

	it('completes a clean case with no tasks and creates no escalation when deadline is ~36h out', async () => {
		const created = await createCase(
			prisma,
			{ case_reference: 'REV-2026-ESC-48H-CLEAN', ...cleanCasePayload },
			{ deadlineHoursFromNow: 36 },
		);

		const response = await withActorHeaders(
			request(server).post(`/api/review-cases/${created.id}/run-rules`),
		);
		const body = response.body as RunRulesResponseDto;

		expect(response.status).toBe(HttpStatus.OK);

		// No task work remains, so the case completes and the deadline escalation is not raised.
		expect(body.risk_level).toBe(SEVERITY_LEVEL.LOW);

		expect(body.results).toHaveLength(0);

		const escalations = await prisma.escalation.findMany({ where: { caseId: created.id } });

		expect(escalations).toHaveLength(0);

		const reviewCase = await prisma.reviewCase.findUniqueOrThrow({ where: { id: created.id } });

		expect(reviewCase.status).toBe(CASE_STATUS.COMPLETED);
	});

	it('completes a clean case with no tasks and creates no escalation when deadline is in the past', async () => {
		const created = await createCase(
			prisma,
			{ case_reference: 'REV-2026-ESC-PASSED-CLEAN', ...cleanCasePayload },
			{ deadlineHoursFromNow: -5 },
		);

		const response = await withActorHeaders(
			request(server).post(`/api/review-cases/${created.id}/run-rules`),
		);
		const body = response.body as RunRulesResponseDto;

		expect(response.status).toBe(HttpStatus.OK);

		expect(body.risk_level).toBe(SEVERITY_LEVEL.LOW);

		expect(body.results).toHaveLength(0);

		const escalations = await prisma.escalation.findMany({ where: { caseId: created.id } });

		expect(escalations).toHaveLength(0);

		const reviewCase = await prisma.reviewCase.findUniqueOrThrow({ where: { id: created.id } });

		expect(reviewCase.status).toBe(CASE_STATUS.COMPLETED);
	});

	it('raises an active high-severity R-DEADLINE-48H escalation when a task keeps the case in review (~36h out)', async () => {
		const created = await createCase(
			prisma,
			{ case_reference: 'REV-2026-ESC-48H-ACTIVE', ...taskCasePayload },
			{ deadlineHoursFromNow: 36 },
		);

		const response = await withActorHeaders(
			request(server).post(`/api/review-cases/${created.id}/run-rules`),
		);
		const body = response.body as RunRulesResponseDto;

		expect(response.status).toBe(HttpStatus.OK);

		expect(body.risk_level).toBe(SEVERITY_LEVEL.HIGH);

		const escalationResults = body.results.filter((result) => result.escalation !== null);

		expect(escalationResults).toHaveLength(1);

		expect(escalationResults[0]).toMatchObject({
			rule_id: 'R-DEADLINE-48H',
			trigger_reason: 'Review deadline within 48 hours',
			severity: SEVERITY_LEVEL.HIGH,
			suggested_action: 'Escalate to shift manager',
		});

		const escalations = await prisma.escalation.findMany({ where: { caseId: created.id } });

		expect(escalations).toHaveLength(1);

		expect(escalations[0]).toMatchObject({
			ruleId: 'R-DEADLINE-48H',
			type: ESCALATION_TYPE.DEADLINE,
			severity: SEVERITY_LEVEL.HIGH,
			status: ESCALATION_STATUS.ACTIVE,
		});

		const reviewCase = await prisma.reviewCase.findUniqueOrThrow({ where: { id: created.id } });

		expect(reviewCase.status).toBe(CASE_STATUS.IN_REVIEW);
	});

	it('raises an active critical R-DEADLINE-PASSED escalation when a task keeps the case in review (past deadline)', async () => {
		const created = await createCase(
			prisma,
			{ case_reference: 'REV-2026-ESC-PASSED-ACTIVE', ...taskCasePayload },
			{ deadlineHoursFromNow: -5 },
		);

		const response = await withActorHeaders(
			request(server).post(`/api/review-cases/${created.id}/run-rules`),
		);
		const body = response.body as RunRulesResponseDto;

		expect(response.status).toBe(HttpStatus.OK);

		expect(body.risk_level).toBe(SEVERITY_LEVEL.CRITICAL);

		const escalationResults = body.results.filter((result) => result.escalation !== null);

		expect(escalationResults).toHaveLength(1);

		expect(escalationResults[0]).toMatchObject({
			rule_id: 'R-DEADLINE-PASSED',
			trigger_reason: 'Review deadline passed',
			severity: SEVERITY_LEVEL.CRITICAL,
			suggested_action: 'Immediate manager escalation',
		});

		const escalations = await prisma.escalation.findMany({ where: { caseId: created.id } });

		expect(escalations).toHaveLength(1);

		expect(escalations[0]).toMatchObject({
			ruleId: 'R-DEADLINE-PASSED',
			type: ESCALATION_TYPE.DEADLINE,
			severity: SEVERITY_LEVEL.CRITICAL,
			status: ESCALATION_STATUS.ACTIVE,
		});
	});

	it('supersedes the 48h escalation with a passed escalation once the deadline moves into the past', async () => {
		const created = await createCase(
			prisma,
			{ case_reference: 'REV-2026-ESC-SUPERSEDE', ...taskCasePayload },
			{ deadlineHoursFromNow: 36 },
		);

		const first = await withActorHeaders(
			request(server).post(`/api/review-cases/${created.id}/run-rules`),
		);

		expect((first.body as RunRulesResponseDto).risk_level).toBe(SEVERITY_LEVEL.HIGH);

		await prisma.reviewCase.update({
			where: { id: created.id },
			data: { deadline: new Date(Date.now() - 5 * 60 * 60 * 1000) },
		});

		const second = await withActorHeaders(
			request(server).post(`/api/review-cases/${created.id}/run-rules`),
		);

		expect(second.status).toBe(HttpStatus.OK);

		expect((second.body as RunRulesResponseDto).risk_level).toBe(SEVERITY_LEVEL.CRITICAL);

		// The lower-severity 48h escalation is resolved (superseded) and replaced by the critical one.
		const escalations = await prisma.escalation.findMany({
			where: { caseId: created.id },
			orderBy: { createdAt: 'asc' },
		});

		expect(escalations).toHaveLength(2);

		expect(escalations[0]).toMatchObject({
			ruleId: 'R-DEADLINE-48H',
			status: ESCALATION_STATUS.RESOLVED,
			resolvedReason: RESOLVED_REASON.SUPERSEDED,
		});

		expect(escalations[1]).toMatchObject({
			ruleId: 'R-DEADLINE-PASSED',
			status: ESCALATION_STATUS.ACTIVE,
		});
	});
});
