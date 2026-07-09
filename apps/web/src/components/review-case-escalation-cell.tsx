import type { ReviewCaseListItemDto } from '../types';
import { SeverityBadge } from './severity-badge';

interface ReviewCaseEscalationCellProps {
	escalations: ReviewCaseListItemDto['escalations'];
}

export function ReviewCaseEscalationCell({ escalations }: ReviewCaseEscalationCellProps) {
	if (!escalations.length) {
		return <span className="text-xs text-muted-foreground">—</span>;
	}

	const primary = escalations[0];

	if (!primary) {
		return <span className="text-xs text-muted-foreground">—</span>;
	}

	const rest = escalations.slice(1);

	return (
		<div className="flex flex-wrap items-center gap-1.5">
			<SeverityBadge severity={primary.severity} />
			<span className="max-w-[180px] truncate text-xs" title={primary.reason}>
				{primary.reason}
			</span>
			{rest.length ? <span className="text-xs text-muted-foreground">+{rest.length}</span> : null}
		</div>
	);
}
