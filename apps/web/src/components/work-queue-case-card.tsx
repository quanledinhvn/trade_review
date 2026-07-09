import { useNavigate } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CaseViewDto } from '../types';
import { formatTimeRemaining } from '../utils/format-deadline';
import { EscalationRow } from './escalation-row';
import { SeverityBadge } from './severity-badge';
import { StatusBadge } from './status-badge';

interface WorkQueueCaseCardProps {
	caseItem: CaseViewDto;
}

export function WorkQueueCaseCard({ caseItem }: WorkQueueCaseCardProps) {
	const navigate = useNavigate();
	const isOverdue = caseItem.time_remaining_hours < 0;

	const handleCaseClick = () => {
		void navigate({
			to: '/cases/$caseRef',
			params: { caseRef: caseItem.case_reference },
			search: { from: 'work-queue' },
		});
	};

	const handleTaskClick = (taskId: string) => {
		void navigate({
			to: '/cases/$caseRef/tasks/$taskId',
			params: { caseRef: caseItem.case_reference, taskId },
		});
	};

	return (
		<article className="overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm">
			<div
				role="button"
				tabIndex={0}
				onClick={handleCaseClick}
				onKeyDown={(event) => {
					if (event.key === 'Enter' || event.key === ' ') {
						event.preventDefault();

						handleCaseClick();
					}
				}}
				className="flex cursor-pointer flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-accent"
			>
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-2">
						<h2 className="text-sm font-semibold">{caseItem.case_reference}</h2>
						<SeverityBadge severity={caseItem.risk_level} />
						<StatusBadge status={caseItem.status} />
					</div>
					<p className="mt-0.5 text-xs text-muted-foreground">
						{caseItem.importer} · {caseItem.shipment_reference}
					</p>
				</div>
				<div className="shrink-0 text-right text-sm">
					<p className={cn('font-medium', isOverdue && 'text-destructive')}>
						{formatTimeRemaining(caseItem.time_remaining_hours)}
					</p>
					<p className="text-xs text-muted-foreground">Deadline {caseItem.deadline}</p>
				</div>
				<ChevronRight className="size-4 shrink-0 text-muted-foreground" />
			</div>

			<div className="space-y-2 border-t bg-muted/20 px-4 py-2">
				<EscalationRow escalations={caseItem.escalations} />
			</div>

			<div className="border-t">
				<div className="bg-muted/10 px-4 py-2">
					<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
						Open tasks ({caseItem.open_tasks.length})
					</p>
				</div>
				{caseItem.open_tasks.map((task) => (
					<div
						key={task.id}
						role="button"
						tabIndex={0}
						onClick={(event) => {
							event.stopPropagation();

							handleTaskClick(task.id);
						}}
						onKeyDown={(event) => {
							if (event.key === 'Enter' || event.key === ' ') {
								event.preventDefault();

								event.stopPropagation();

								handleTaskClick(task.id);
							}
						}}
						className="flex cursor-pointer items-center gap-3 border-t px-4 py-3 transition-colors hover:bg-accent"
					>
						<div className="min-w-0 flex-1">
							<p className="truncate text-sm font-medium">{task.title}</p>
							<p className="truncate text-xs text-muted-foreground">{task.suggested_action}</p>
						</div>
						<div className="flex shrink-0 items-center gap-2">
							<SeverityBadge severity={task.severity} />
							<StatusBadge status={task.status} />
							<ChevronRight className="size-4 text-muted-foreground" />
						</div>
					</div>
				))}
			</div>
		</article>
	);
}
