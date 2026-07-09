import { HttpStatus, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AUDIT_ACTION } from '../../src/domain/audit';
import { RISK_LEVEL } from '../../src/domain/severity';
import {
	ESCALATION_STATUS,
	ESCALATION_TYPE,
	RESOLVED_REASON,
} from '../../src/domain/types';
import { PrismaService } from '../../src/database/prisma.service';
import type { ReviewCaseResponseDto } from '../../src/modules/review-cases/dto/review-case-response.dto';
import type { RunRulesResponseDto } from '../../src/modules/review-cases/dto/run-rules-response.dto';
import { cleanCasePayload, createCase, seedInReviewCase, withActorHeaders } from '../utils';

describe('Escalations (e2e)', () => {
	let server: Parameters<typeof request>[0];
	let app: INestApplication;
	let prisma: PrismaService;

	beforeAll(async () => {
		app = global.testContext.app;

		server = app.getHttpServer();

		prisma = app.get(PrismaService);
	});

	it('creates an active high-severity R-DEADLINE-48H escalation when deadline is ~36h out', async () => {
		const created = await createCase(
			prisma,
			{ case_reference: 'REV-2026-ESC-48H', ...cleanCasePayload },
			{ deadlineHoursFromNow: 36 },
		);

		const response = await withActorHeaders(request(server).post(`/api/review-cases/${created.id}/run-rules`));
		const body = response.body as RunRulesResponseDto;

		expect(response.status).toBe(HttpStatus.OK);

		expect(body.risk_level).toBe(RISK_LEVEL.HIGH);

		expect(body.escalations).toBe(1);

		const escalations = await prisma.escalation.findMany({ where: { caseId: created.id } });

		expect(escalations).toHaveLength(1);

		expect(escalations[0]).toMatchObject({
			ruleId: 'R-DEADLINE-48H',
			type: ESCALATION_TYPE.DEADLINE,
			severity: RISK_LEVEL.HIGH,
			status: ESCALATION_STATUS.ACTIVE,
		});
	});

	it('creates an active critical R-DEADLINE-PASSED escalation when deadline is in the past', async () => {
		const created = await createCase(
			prisma,
			{ case_reference: 'REV-2026-ESC-PASSED', ...cleanCasePayload },
			{ deadlineHoursFromNow: -5 },
		);

		const response = await withActorHeaders(request(server).post(`/api/review-cases/${created.id}/run-rules`));
		const body = response.body as RunRulesResponseDto;

		expect(response.status).toBe(HttpStatus.OK);

		expect(body.risk_level).toBe(RISK_LEVEL.CRITICAL);

		expect(body.escalations).toBe(1);

		const escalations = await prisma.escalation.findMany({ where: { caseId: created.id } });

		expect(escalations).toHaveLength(1);

		expect(escalations[0]).toMatchObject({
			ruleId: 'R-DEADLINE-PASSED',
			type: ESCALATION_TYPE.DEADLINE,
			severity: RISK_LEVEL.CRITICAL,
			status: ESCALATION_STATUS.ACTIVE,
		});
	});

	it('supersedes the 48h escalation with a passed escalation once the deadline moves into the past', async () => {
		const created = await createCase(
			prisma,
			{ case_reference: 'REV-2026-ESC-SUPERSEDE', ...cleanCasePayload },
			{ deadlineHoursFromNow: 36 },
		);

		const first = await withActorHeaders(request(server).post(`/api/review-cases/${created.id}/run-rules`));

		expect((first.body as RunRulesResponseDto).risk_level).toBe(RISK_LEVEL.HIGH);

		await prisma.reviewCase.update({
			where: { id: created.id },
			data: { deadline: new Date(Date.now() - 5 * 60 * 60 * 1000) },
		});

		const second = await withActorHeaders(request(server).post(`/api/review-cases/${created.id}/run-rules`));

		expect(second.status).toBe(HttpStatus.OK);

		expect((second.body as RunRulesResponseDto).risk_level).toBe(RISK_LEVEL.CRITICAL);

		expect((second.body as RunRulesResponseDto).escalations).toBe(1);

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

		expect(escalations[0]?.resolvedAt).not.toBeNull();

		expect(escalations[1]).toMatchObject({
			ruleId: 'R-DEADLINE-PASSED',
			status: ESCALATION_STATUS.ACTIVE,
		});

		const escalationAudits = await prisma.auditLog.findMany({
			where: {
				caseId: created.id,
				action: { in: [AUDIT_ACTION.ESCALATION_CREATED, AUDIT_ACTION.ESCALATION_SUPERSEDED] },
			},
		});

		expect(escalationAudits).toHaveLength(3);

		expect(escalationAudits.filter((audit) => audit.action === AUDIT_ACTION.ESCALATION_CREATED)).toHaveLength(2);

		expect(escalationAudits.filter((audit) => audit.action === AUDIT_ACTION.ESCALATION_SUPERSEDED)).toHaveLength(
			1,
		);
	});

	it('is idempotent: re-running with no state change does not duplicate active escalations or audit rows', async () => {
		const created = await createCase(
			prisma,
			{ case_reference: 'REV-2026-ESC-IDEMPOTENT', ...cleanCasePayload },
			{ deadlineHoursFromNow: -5 },
		);

		await withActorHeaders(request(server).post(`/api/review-cases/${created.id}/run-rules`));

		const second = await withActorHeaders(request(server).post(`/api/review-cases/${created.id}/run-rules`));

		expect(second.status).toBe(HttpStatus.OK);

		expect((second.body as RunRulesResponseDto).escalations).toBe(1);

		const escalations = await prisma.escalation.findMany({ where: { caseId: created.id } });

		expect(escalations).toHaveLength(1);

		expect(escalations[0]).toMatchObject({ status: ESCALATION_STATUS.ACTIVE, ruleId: 'R-DEADLINE-PASSED' });

		const escalationAudits = await prisma.auditLog.findMany({
			where: { caseId: created.id, action: AUDIT_ACTION.ESCALATION_CREATED },
		});

		expect(escalationAudits).toHaveLength(1);
	});

	it('GET /review-cases/:id includes the escalations array', async () => {
		const seeded = await seedInReviewCase(
			prisma,
			{ case_reference: 'REV-2026-ESC-GET', ...cleanCasePayload },
			{ deadlineHoursFromNow: 36 },
		);

		const response = await request(server).get(`/api/review-cases/${seeded.id}`);
		const body = response.body as ReviewCaseResponseDto & {
			escalations: Array<Record<string, unknown>>;
		};

		expect(response.status).toBe(HttpStatus.OK);

		expect(body.escalations).toHaveLength(1);

		expect(body.escalations[0]).toMatchObject({
			rule_id: 'R-DEADLINE-48H',
			type: ESCALATION_TYPE.DEADLINE,
			severity: RISK_LEVEL.HIGH,
			status: ESCALATION_STATUS.ACTIVE,
			resolved_reason: null,
		});

		expect(typeof body.escalations[0]?.id).toBe('string');

		expect(typeof body.escalations[0]?.reason).toBe('string');

		expect(typeof body.escalations[0]?.suggested_action).toBe('string');

		expect(typeof body.escalations[0]?.created_at).toBe('string');
	});
});
