import type { Prisma } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const prisma = new PrismaClient();
const seedDataDir = join(__dirname, 'seed-data');

function loadJson<T>(filename: string): T[] {
	return JSON.parse(readFileSync(join(seedDataDir, filename), 'utf-8')) as T[];
}

async function main() {
	const reviewCases = loadJson<Prisma.ReviewCaseCreateManyInput>('review-cases.json');
	const tasks = loadJson<Prisma.TaskCreateManyInput>('tasks.json');
	const escalations = loadJson<Prisma.EscalationCreateManyInput>('escalations.json');
	const auditLogs = loadJson<Prisma.AuditLogCreateManyInput>('audit-logs.json');

	await prisma.$transaction([
		prisma.auditLog.deleteMany(),
		prisma.escalation.deleteMany(),
		prisma.task.deleteMany(),
		prisma.reviewCase.deleteMany(),
		prisma.reviewCase.createMany({ data: reviewCases }),
		prisma.task.createMany({ data: tasks }),
		prisma.escalation.createMany({ data: escalations }),
		prisma.auditLog.createMany({ data: auditLogs }),
	]);

	console.log(
		`Seeded ${reviewCases.length} review case(s), ${tasks.length} task(s), ${escalations.length} escalation(s), ${auditLogs.length} audit log(s).`,
	);
}

main()
	.catch((error) => {
		console.error(error);

		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
