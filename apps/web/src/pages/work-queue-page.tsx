import { useEffect, useState } from 'react';
import { fetchWorkQueue } from '../api/work-queue.api';
import { EmptyState } from '../components/empty-state';
import { PaginationControls, toPaginationState } from '../components/pagination-controls';
import { WorkQueueCaseCard } from '../components/work-queue-case-card';
import { WorkQueueFilters } from '../components/work-queue-filters';
import { useWorkQueueFilterStore, useTradeReviewRefreshStore } from '../stores/session.store';
import type { WorkQueueQuery, WorkQueueResponse } from '../types';

const DEFAULT_LIMIT = 20;

export function WorkQueuePage() {
	const assignedTeam = useWorkQueueFilterStore((state) => state.assignedTeam);
	const assignedUser = useWorkQueueFilterStore((state) => state.assignedUser);
	const setAssignedTeam = useWorkQueueFilterStore((state) => state.setAssignedTeam);
	const setAssignedUser = useWorkQueueFilterStore((state) => state.setAssignedUser);
	const refreshKey = useTradeReviewRefreshStore((state) => state.refreshKey);

	const [deadline, setDeadline] = useState<NonNullable<WorkQueueQuery['deadline']>>('all');
	const [sort, setSort] = useState<NonNullable<WorkQueueQuery['sort']>>('risk');
	const [page, setPage] = useState(1);
	const [limit, setLimit] = useState(DEFAULT_LIMIT);
	const [data, setData] = useState<WorkQueueResponse | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [trackedAssignment, setTrackedAssignment] = useState({ assignedTeam, assignedUser });
	const [trackedQueryKey, setTrackedQueryKey] = useState('');

	const queryKey = `${assignedTeam}|${assignedUser}|${deadline}|${sort}|${page}|${limit}|${refreshKey}`;

	if (
		trackedAssignment.assignedTeam !== assignedTeam ||
		trackedAssignment.assignedUser !== assignedUser
	) {
		setTrackedAssignment({ assignedTeam, assignedUser });

		setPage(1);
	}

	if (trackedQueryKey !== queryKey) {
		setTrackedQueryKey(queryKey);

		setIsLoading(true);

		setError(null);
	}

	const handleAssignedTeamChange = (value: string) => {
		setPage(1);

		setAssignedTeam(value);
	};

	const handleAssignedUserChange = (value: string) => {
		setPage(1);

		setAssignedUser(value);
	};

	const handleDeadlineChange = (value: NonNullable<WorkQueueQuery['deadline']>) => {
		setPage(1);

		setDeadline(value);
	};

	const handleSortChange = (value: NonNullable<WorkQueueQuery['sort']>) => {
		setPage(1);

		setSort(value);
	};

	useEffect(() => {
		let cancelled = false;

		fetchWorkQueue({
			assigned_team: assignedTeam.trim() || undefined,
			assigned_user: assignedUser.trim() || undefined,
			deadline,
			sort,
			page,
			limit,
		})
			.then((response) => {
				if (!cancelled) {
					setData(response);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setError('Failed to load work queue.');

					setData(null);
				}
			})
			.finally(() => {
				if (!cancelled) {
					setIsLoading(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [assignedTeam, assignedUser, deadline, sort, page, limit, refreshKey]);

	const pagination = toPaginationState(data?.total ?? 0, page, limit);
	const hasResults = Boolean(data?.items.length);

	return (
		<div>
			<div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<h1 className="text-2xl font-semibold tracking-tight">Work Queue</h1>
				<WorkQueueFilters
					assignedTeam={assignedTeam}
					assignedUser={assignedUser}
					deadline={deadline}
					sort={sort}
					onAssignedTeamChange={handleAssignedTeamChange}
					onAssignedUserChange={handleAssignedUserChange}
					onDeadlineChange={handleDeadlineChange}
					onSortChange={handleSortChange}
				/>
			</div>

			{isLoading ? (
				<p className="text-sm text-muted-foreground">Loading work queue…</p>
			) : error ? (
				<p className="text-sm text-destructive">{error}</p>
			) : !hasResults ? (
				<EmptyState
					title="No cases match the current filters."
					description="Try clearing assigned_user or changing assigned_team."
				/>
			) : (
				<div className="space-y-4">
					{data?.items.map((caseItem) => (
						<WorkQueueCaseCard key={caseItem.case_reference} caseItem={caseItem} />
					))}
				</div>
			)}

			<div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
				<span>
					{data?.total
						? `Showing ${pagination.start}–${pagination.end} of ${pagination.total} cases · page ${pagination.page}/${pagination.totalPages}`
						: 'Showing 0 cases'}
				</span>
				<PaginationControls
					pagination={pagination}
					onPageChange={setPage}
					onLimitChange={(nextLimit) => {
						setLimit(nextLimit);

						setPage(1);
					}}
				/>
			</div>
		</div>
	);
}
