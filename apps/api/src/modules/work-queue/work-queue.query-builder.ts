import type { Prisma } from '@prisma/client';
import {
	APPROACHING_DEADLINE_HOURS,
	CASE_STATUS,
	ESCALATION_STATUS,
	maxApproachingDeadlineDate,
	maxPastDeadlineDate,
	minApproachingDeadlineDate,
	TASK_STATUS,
} from '../../domain';
import type { WorkQueueQueryDto } from './dto/work-queue-query.dto';
import {
	WORK_QUEUE_DEADLINE,
	WORK_QUEUE_SORT,
	type WorkQueueActiveDeadlineFilter,
} from './work-queue-query';

export type WorkQueueFindManyArgs = {
	where: Prisma.ReviewCaseWhereInput;
	orderBy: Prisma.ReviewCaseOrderByWithRelationInput[];
	skip: number;
	take: number;
	include: Prisma.ReviewCaseInclude;
};

export class WorkQueueQueryBuilder {
	private readonly query: WorkQueueQueryDto;
	private readonly now: Date;

	private constructor(query: WorkQueueQueryDto, now: Date) {
		this.query = query;

		this.now = now;
	}

	static from(query: WorkQueueQueryDto, now = new Date()): WorkQueueQueryBuilder {
		return new WorkQueueQueryBuilder(query, now);
	}

	build(): WorkQueueFindManyArgs {
		return {
			where: this.buildWhere(),
			orderBy: this.buildOrderBy(),
			skip: this.skip,
			take: this.take,
			include: this.buildInclude(),
		};
	}

	get skip(): number {
		return (this.page - 1) * this.take;
	}

	get take(): number {
		return this.query.limit ?? 20;
	}

	private get page(): number {
		return this.query.page ?? 1;
	}

	private buildWhere(): Prisma.ReviewCaseWhereInput {
		const conditions: Prisma.ReviewCaseWhereInput[] = [{ status: CASE_STATUS.IN_REVIEW }];

		if (this.query.assigned_team) {
			conditions.push({ assignedTeam: this.query.assigned_team });
		}

		if (this.query.assigned_user) {
			conditions.push({ assignedUser: this.query.assigned_user });
		}

		const deadlineFilter = this.query.deadline ?? WORK_QUEUE_DEADLINE.ALL;

		if (deadlineFilter !== WORK_QUEUE_DEADLINE.ALL) {
			conditions.push(this.buildDeadlineCondition(deadlineFilter));
		}

		return { AND: conditions };
	}

	private buildDeadlineCondition(
		deadlineFilter: WorkQueueActiveDeadlineFilter,
	): Prisma.ReviewCaseWhereInput {
		if (deadlineFilter === WORK_QUEUE_DEADLINE.PAST) {
			return { deadline: { lte: maxPastDeadlineDate(this.now) } };
		}

		return {
			deadline: {
				gte: minApproachingDeadlineDate(this.now),
				lte: maxApproachingDeadlineDate(this.now, APPROACHING_DEADLINE_HOURS),
			},
		};
	}

	private buildOrderBy(): Prisma.ReviewCaseOrderByWithRelationInput[] {
		const sort = this.query.sort ?? WORK_QUEUE_SORT.RISK;

		return sort === WORK_QUEUE_SORT.DEADLINE
			? [{ deadline: 'asc' }, { riskRank: 'desc' }]
			: [{ riskRank: 'desc' }, { deadline: 'asc' }];
	}

	private buildInclude(): Prisma.ReviewCaseInclude {
		return {
			tasks: {
				where: { status: TASK_STATUS.OPEN },
				orderBy: [{ severityRank: 'desc' }, { dueDate: 'asc' }],
			},
			escalations: {
				where: { status: ESCALATION_STATUS.ACTIVE },
			},
		};
	}
}
