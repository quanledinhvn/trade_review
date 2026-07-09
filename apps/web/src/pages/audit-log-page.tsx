import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { ChevronLeft } from 'lucide-react';
import { fetchAuditLog } from '@/api/audit-log.api';
import { AuditLogEntryRow } from '@/components/audit-log-entry';
import { Button } from '@/components/ui/button';
import { useTradeReviewRefreshStore } from '@/stores/session.store';
import type { AuditLogEntry, CaseDetailFrom } from '@/types';

export function AuditLogPage() {
	const { caseRef } = useParams({ from: '/_app/cases/$caseRef/audit-log' });
	const { from } = useSearch({ from: '/_app/cases/$caseRef/audit-log' });
	const navigate = useNavigate();
	const refreshKey = useTradeReviewRefreshStore((state) => state.refreshKey);

	const backFrom: CaseDetailFrom = from ?? 'work-queue';

	const [entries, setEntries] = useState<AuditLogEntry[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [trackedCaseRef, setTrackedCaseRef] = useState(caseRef);

	if (trackedCaseRef !== caseRef) {
		setTrackedCaseRef(caseRef);

		setIsLoading(true);

		setError(null);
	}

	useEffect(() => {
		let cancelled = false;

		fetchAuditLog(caseRef)
			.then((items) => {
				if (!cancelled) {
					setEntries(items);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setError('Failed to load audit log.');

					setEntries([]);
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
	}, [caseRef, refreshKey]);

	const handleBack = () => {
		void navigate({
			to: '/cases/$caseRef',
			params: { caseRef },
			search: { from: backFrom },
		});
	};

	if (isLoading) {
		return <p className="text-sm text-muted-foreground">Loading audit log…</p>;
	}

	if (error) {
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
						Back to case
					</Button>
				</nav>
				<p className="text-sm text-destructive">{error}</p>
			</div>
		);
	}

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
					Back to case
				</Button>
			</nav>

			<div className="mb-6">
				<div className="flex flex-wrap items-center gap-2">
					<h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
					<span className="text-sm text-muted-foreground">{caseRef}</span>
				</div>
				<p className="mt-1 text-sm text-muted-foreground">
					{entries.length} event{entries.length !== 1 ? 's' : ''} · sorted oldest first
				</p>
			</div>

			<div className="overflow-hidden rounded-lg border bg-card shadow-sm">
				{entries.length ? (
					<div className="divide-y">
						{entries.map((entry, index) => (
							<AuditLogEntryRow
								key={entry.id}
								entry={entry}
								isMostRecent={index === entries.length - 1}
							/>
						))}
					</div>
				) : (
					<p className="px-6 py-4 text-sm text-muted-foreground">No audit events recorded.</p>
				)}
			</div>
		</div>
	);
}
