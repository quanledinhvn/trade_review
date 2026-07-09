import { cn } from '@/lib/utils';
import type { CaseStatus, TaskStatus } from '../types';

type StatusValue = CaseStatus | TaskStatus;

const statusStyles: Record<StatusValue, string> = {
	open: 'bg-secondary text-secondary-foreground',
	in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
	blocked: 'bg-orange-50 text-orange-700 border-orange-200',
	completed: 'bg-green-50 text-green-700 border-green-200',
	cancelled: 'bg-muted text-muted-foreground',
	in_review: 'bg-blue-50 text-blue-700 border-blue-200',
};

function formatStatusLabel(status: StatusValue): string {
	return status.replace(/_/g, ' ');
}

interface StatusBadgeProps {
	status: StatusValue;
	className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
	return (
		<span
			className={cn(
				'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize',
				statusStyles[status],
				className,
			)}
		>
			{formatStatusLabel(status)}
		</span>
	);
}
