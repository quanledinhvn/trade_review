import { useNavigate } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import type { TaskDto } from '../types';
import { SeverityBadge } from './severity-badge';
import { StatusBadge } from './status-badge';

interface CaseTaskRowProps {
	caseRef: string;
	task: TaskDto;
}

export function CaseTaskRow({ caseRef, task }: CaseTaskRowProps) {
	const navigate = useNavigate();

	const handleClick = () => {
		void navigate({
			to: '/cases/$caseRef/tasks/$taskId',
			params: { caseRef, taskId: task.id },
		});
	};

	return (
		<div
			role="button"
			tabIndex={0}
			onClick={handleClick}
			onKeyDown={(event) => {
				if (event.key === 'Enter' || event.key === ' ') {
					event.preventDefault();

					handleClick();
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
	);
}
