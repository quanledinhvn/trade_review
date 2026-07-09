import { cn } from '@/lib/utils';

const actionStyles: Record<string, string> = {
	case_created: 'bg-green-50 text-green-700 border-green-200',
	rules_executed: 'bg-purple-50 text-purple-700 border-purple-200',
	task_created: 'bg-blue-50 text-blue-700 border-blue-200',
	task_completed: 'bg-green-50 text-green-700 border-green-200',
	task_reassigned: 'bg-orange-50 text-orange-700 border-orange-200',
	escalation_changed: 'bg-red-50 text-red-700 border-red-200',
	escalation_created: 'bg-red-50 text-red-700 border-red-200',
	escalation_resolved: 'bg-green-50 text-green-700 border-green-200',
	escalation_superseded: 'bg-yellow-50 text-yellow-800 border-yellow-200',
	case_status_changed: 'bg-yellow-50 text-yellow-800 border-yellow-200',
	case_updated: 'bg-yellow-50 text-yellow-800 border-yellow-200',
	case_reassigned: 'bg-orange-50 text-orange-700 border-orange-200',
	case_cancelled: 'bg-muted text-muted-foreground',
};

function formatActionLabel(action: string): string {
	return action.replace(/_/g, ' ');
}

interface AuditActionBadgeProps {
	action: string;
	className?: string;
}

export function AuditActionBadge({ action, className }: AuditActionBadgeProps) {
	return (
		<span
			className={cn(
				'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
				actionStyles[action] ?? 'bg-secondary text-secondary-foreground',
				className,
			)}
		>
			{formatActionLabel(action)}
		</span>
	);
}
