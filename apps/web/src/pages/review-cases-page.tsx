import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { fetchReviewCases } from '../api/review-cases.api';
import { AddReviewCaseDialog } from '../components/add-review-case-dialog';
import { EmptyState } from '../components/empty-state';
import { PaginationControls, toPaginationState } from '../components/pagination-controls';
import { ReviewCaseEscalationCell } from '../components/review-case-escalation-cell';
import { SeverityBadge } from '../components/severity-badge';
import { StatusBadge } from '../components/status-badge';
import { useSessionStore, useTradeReviewRefreshStore } from '../stores/session.store';
import type { ReviewCasesQuery, ReviewCasesResponse, ReviewCasesStatusFilter } from '../types';
import { formatTimeRemaining } from '../utils/format-deadline';

const DEFAULT_LIMIT = 20;

const STATUS_OPTIONS: Array<{ value: ReviewCasesStatusFilter; label: string }> = [
	{ value: 'all', label: 'Status: All' },
	{ value: 'open', label: 'Open' },
	{ value: 'in_review', label: 'In review' },
	{ value: 'completed', label: 'Completed' },
];

export function ReviewCasesPage() {
	const navigate = useNavigate();
	const defaultAssignedTeam = useSessionStore((state) => state.team);
	const refreshKey = useTradeReviewRefreshStore((state) => state.refreshKey);

	const [status, setStatus] = useState<ReviewCasesStatusFilter>('all');
	const [page, setPage] = useState(1);
	const [limit, setLimit] = useState(DEFAULT_LIMIT);
	const [data, setData] = useState<ReviewCasesResponse | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [trackedQueryKey, setTrackedQueryKey] = useState('');
	const queryKey = `${status}|${page}|${limit}|${refreshKey}`;

	if (trackedQueryKey !== queryKey) {
		setTrackedQueryKey(queryKey);

		setIsLoading(true);

		setError(null);
	}

	useEffect(() => {
		let cancelled = false;

		fetchReviewCases({
			status,
			page,
			limit,
		} satisfies ReviewCasesQuery)
			.then((response) => {
				if (!cancelled) {
					setData(response);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setError('Failed to load review cases.');

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
	}, [status, page, limit, refreshKey]);

	const handleStatusChange = (value: ReviewCasesStatusFilter) => {
		setPage(1);

		setStatus(value);
	};

	const handleRowClick = (caseReference: string) => {
		void navigate({
			to: '/cases/$caseRef',
			params: { caseRef: caseReference },
			search: { from: 'review-cases' },
		});
	};

	const handleCaseCreated = (caseReference: string) => {
		void navigate({
			to: '/cases/$caseRef',
			params: { caseRef: caseReference },
			search: { from: 'review-cases' },
		});
	};

	const pagination = toPaginationState(data?.total ?? 0, page, limit);
	const hasResults = Boolean(data?.items.length);

	return (
		<div>
			<div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">Review Cases</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						All shipment review cases — case overview only
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Select value={status} onValueChange={handleStatusChange}>
						<SelectTrigger className="h-9 w-[180px]">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{STATUS_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Button type="button" className="h-9 gap-2" onClick={() => setIsDialogOpen(true)}>
						<Plus className="size-4" />
						Add review case
					</Button>
				</div>
			</div>

			<div className="overflow-hidden rounded-lg border bg-card shadow-sm">
				{isLoading ? (
					<p className="px-6 py-12 text-sm text-muted-foreground">Loading review cases…</p>
				) : error ? (
					<p className="px-6 py-12 text-sm text-destructive">{error}</p>
				) : !hasResults ? (
					<EmptyState
						title="No cases match this status filter."
						description="Try a different status or add a new review case."
						className="border-0 bg-transparent shadow-none"
					/>
				) : (
					<div className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow className="bg-muted/40 hover:bg-muted/40">
									<TableHead>Case</TableHead>
									<TableHead>Importer</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Risk</TableHead>
									<TableHead>Deadline</TableHead>
									<TableHead className="min-w-[220px]">Escalation</TableHead>
									<TableHead>Team</TableHead>
									<TableHead className="w-10" />
								</TableRow>
							</TableHeader>
							<TableBody>
								{data?.items.map((caseItem) => {
									const isTerminal = caseItem.status === 'completed';
									const isOverdue = !isTerminal && caseItem.time_remaining_hours < 0;

									return (
										<TableRow
											key={caseItem.case_reference}
											className="cursor-pointer"
											onClick={() => handleRowClick(caseItem.case_reference)}
										>
											<TableCell>
												<p className="font-medium">{caseItem.case_reference}</p>
												<p className="text-xs text-muted-foreground">
													{caseItem.shipment_reference}
												</p>
											</TableCell>
											<TableCell className="text-muted-foreground">{caseItem.importer}</TableCell>
											<TableCell>
												<StatusBadge status={caseItem.status} />
											</TableCell>
											<TableCell>
												<SeverityBadge severity={caseItem.risk_level} />
											</TableCell>
											<TableCell>
												<p className={cn('font-medium', isOverdue && 'text-destructive')}>
													{caseItem.deadline}
												</p>
												<p className="text-xs text-muted-foreground">
													{isTerminal ? '—' : formatTimeRemaining(caseItem.time_remaining_hours)}
												</p>
											</TableCell>
											<TableCell>
												<ReviewCaseEscalationCell escalations={caseItem.escalations} />
											</TableCell>
											<TableCell className="text-muted-foreground">
												{caseItem.assigned_team}
											</TableCell>
											<TableCell>
												<ChevronRight className="size-4 text-muted-foreground" />
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					</div>
				)}
			</div>

			<div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
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

			<AddReviewCaseDialog
				open={isDialogOpen}
				onOpenChange={setIsDialogOpen}
				defaultAssignedTeam={defaultAssignedTeam}
				onCreated={handleCaseCreated}
			/>
		</div>
	);
}
