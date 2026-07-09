import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import axios from 'axios';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fetchCaseTasks, fetchReviewCase, runCaseRules } from '../api/case-detail.api';
import { CaseTaskRow } from '../components/case-task-row';
import { DocumentChecklist } from '../components/document-checklist';
import { EscalationRow } from '../components/escalation-row';
import { SeverityBadge } from '../components/severity-badge';
import { StatusBadge } from '../components/status-badge';
import { useTradeReviewRefreshStore } from '../stores/session.store';
import type { CaseDetailFrom, ReviewCaseDetail, TaskDto } from '../types';
import { formatDeadlineRemaining } from '../utils/format-deadline';

const BACK_LABELS: Record<CaseDetailFrom, string> = {
	'work-queue': 'Back to work queue',
	'review-cases': 'Back to review cases',
};

const BACK_ROUTES: Record<CaseDetailFrom, '/work-queue' | '/review-cases'> = {
	'work-queue': '/work-queue',
	'review-cases': '/review-cases',
};

function formatPackagingLabel(packagingType: string): string {
	return packagingType.replace(/_/g, ' ');
}

function getRunRulesErrorMessage(error: unknown): string {
	if (axios.isAxiosError(error)) {
		const message = error.response?.data?.error?.message;

		if (typeof message === 'string') {
			return message;
		}
	}

	return 'Failed to run rules. Please try again.';
}

async function loadCaseData(caseRef: string) {
	const [caseResponse, tasks] = await Promise.all([
		fetchReviewCase(caseRef),
		fetchCaseTasks(caseRef, 'open'),
	]);

	return {
		caseResponse,
		tasks,
	};
}

export function CaseDetailPage() {
	const { caseRef } = useParams({ from: '/_app/cases/$caseRef' });
	const { from } = useSearch({ from: '/_app/cases/$caseRef' });
	const navigate = useNavigate();
	const notifyTradeReviewMutated = useTradeReviewRefreshStore(
		(state) => state.notifyTradeReviewMutated,
	);

	const backFrom: CaseDetailFrom = from ?? 'work-queue';

	const [caseDetail, setCaseDetail] = useState<ReviewCaseDetail | null>(null);
	const [tasks, setTasks] = useState<TaskDto[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [actionError, setActionError] = useState<string | null>(null);
	const [isRunningRules, setIsRunningRules] = useState(false);
	const [trackedCaseRef, setTrackedCaseRef] = useState(caseRef);

	if (trackedCaseRef !== caseRef) {
		setTrackedCaseRef(caseRef);

		setIsLoading(true);

		setError(null);
	}

	const applyCaseData = (caseResponse: ReviewCaseDetail, nextTasks: TaskDto[]) => {
		setCaseDetail(caseResponse);

		setTasks(nextTasks);
	};

	useEffect(() => {
		let cancelled = false;

		loadCaseData(caseRef)
			.then(({ caseResponse, tasks }) => {
				if (!cancelled) {
					applyCaseData(caseResponse, tasks);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setError('Failed to load case detail.');

					setCaseDetail(null);

					setTasks([]);
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
	}, [caseRef]);

	const handleBack = () => {
		void navigate({ to: BACK_ROUTES[backFrom] });
	};

	const handleMutationSuccess = () => {
		notifyTradeReviewMutated();

		void loadCaseData(caseRef)
			.then(({ caseResponse, tasks }) => applyCaseData(caseResponse, tasks))
			.catch(() => setError('Failed to load case detail.'));
	};

	const handleRunRules = async () => {
		if (!caseDetail || caseDetail.status === 'completed') {
			return;
		}

		setIsRunningRules(true);

		setActionError(null);

		try {
			await runCaseRules(caseRef);

			handleMutationSuccess();
		} catch (runRulesError) {
			setActionError(getRunRulesErrorMessage(runRulesError));
		} finally {
			setIsRunningRules(false);
		}
	};

	const activeEscalations =
		caseDetail?.escalations.filter((escalation) => escalation.status === 'active') ?? [];

	if (isLoading) {
		return <p className="text-sm text-muted-foreground">Loading case detail…</p>;
	}

	if (error || !caseDetail) {
		return (
			<div>
				<nav className="mb-4">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-auto px-0 text-muted-foreground hover:text-foreground"
						onClick={handleBack}
					>
						<ChevronLeft />
						{BACK_LABELS[backFrom]}
					</Button>
				</nav>
				<p className="text-sm text-destructive">{error ?? 'Case not found.'}</p>
			</div>
		);
	}

	const isCompleted = caseDetail.status === 'completed';

	return (
		<div>
			<nav className="mb-4">
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="h-auto px-0 text-muted-foreground hover:text-foreground"
					onClick={handleBack}
				>
					<ChevronLeft />
					{BACK_LABELS[backFrom]}
				</Button>
			</nav>

			<div className="mb-4 flex flex-wrap items-start justify-between gap-4">
				<div>
					<div className="flex flex-wrap items-center gap-2">
						<h1 className="text-2xl font-semibold tracking-tight">{caseDetail.case_reference}</h1>
						<SeverityBadge severity={caseDetail.risk_level} />
						<StatusBadge status={caseDetail.status} />
					</div>
					<p className="mt-1 text-sm text-muted-foreground">{caseDetail.importer}</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() =>
							void navigate({
								to: '/cases/$caseRef/audit-log',
								params: { caseRef },
								search: { from: backFrom },
							})
						}
					>
						Audit log
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => void handleRunRules()}
						disabled={isCompleted || isRunningRules}
					>
						{isRunningRules ? 'Running rules…' : 'Run rules'}
					</Button>
				</div>
			</div>

			{actionError ? <p className="mb-4 text-sm text-destructive">{actionError}</p> : null}

			<div className="mb-6 space-y-2">
				<h3 className="text-sm font-medium text-muted-foreground">Escalations</h3>
				<EscalationRow escalations={activeEscalations} />
			</div>

			<div className="mb-6 rounded-lg border bg-card shadow-sm">
				<div className="border-b px-6 py-4">
					<h3 className="font-semibold">Case information</h3>
				</div>
				<dl className="grid gap-x-6 gap-y-4 px-6 py-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
					<div>
						<dt className="text-muted-foreground">Shipment</dt>
						<dd className="mt-0.5 font-medium">{caseDetail.shipment_reference}</dd>
					</div>
					<div>
						<dt className="text-muted-foreground">Arrival date</dt>
						<dd className="mt-0.5 font-medium">{caseDetail.arrival_date}</dd>
					</div>
					<div>
						<dt className="text-muted-foreground">Review window</dt>
						<dd className="mt-0.5 font-medium">{caseDetail.review_window_days} days</dd>
					</div>
					<div>
						<dt className="text-muted-foreground">Deadline</dt>
						<dd className="mt-0.5 font-medium">
							{caseDetail.deadline}{' '}
							<span className="text-muted-foreground">
								({formatDeadlineRemaining(caseDetail.time_remaining_hours)})
							</span>
						</dd>
					</div>
					<div>
						<dt className="text-muted-foreground">Invoice value</dt>
						<dd className="mt-0.5 font-medium">${caseDetail.invoice_value.toLocaleString()}</dd>
					</div>
					<div>
						<dt className="text-muted-foreground">Packaging</dt>
						<dd className="mt-0.5 font-medium capitalize">
							{formatPackagingLabel(caseDetail.packaging_type)}{' '}
							{caseDetail.ispm15_certified ? '· ISPM-15 ✓' : '· ISPM-15 ✗'}
						</dd>
					</div>
					<div>
						<dt className="text-muted-foreground">Assigned team</dt>
						<dd className="mt-0.5 font-medium">{caseDetail.assigned_team}</dd>
					</div>
					<div>
						<dt className="text-muted-foreground">Assigned user</dt>
						<dd className="mt-0.5 font-medium">{caseDetail.assigned_user ?? '—'}</dd>
					</div>
					<div className="sm:col-span-2 lg:col-span-3">
						<dt className="mb-1 text-muted-foreground">Documents</dt>
						<dd>
							<DocumentChecklist
								requiredDocuments={caseDetail.required_documents}
								completedDocuments={caseDetail.completed_documents}
							/>
						</dd>
					</div>
				</dl>
			</div>

			<div className="overflow-hidden rounded-lg border bg-card shadow-sm">
				<div className="flex items-center justify-between border-b px-6 py-4">
					<h3 className="font-semibold">Tasks</h3>
					<span className="text-sm text-muted-foreground">{tasks.length} open</span>
				</div>
				{tasks.length ? (
					tasks.map((task) => <CaseTaskRow key={task.id} caseRef={caseRef} task={task} />)
				) : (
					<p className="px-6 py-4 text-sm text-muted-foreground">No open tasks.</p>
				)}
			</div>
		</div>
	);
}
