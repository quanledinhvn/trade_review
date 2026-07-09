import { AlertTriangle, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EscalationDto } from '../types';
import { SeverityBadge } from './severity-badge';

type EscalationView = Pick<EscalationDto, 'severity' | 'reason' | 'suggested_action'>;

interface EscalationRowProps {
	escalations: EscalationView[];
}

const severityRowStyles: Record<EscalationView['severity'], string> = {
	critical: 'bg-[hsl(0_84%_97%)] text-[hsl(0_72%_35%)] border-[hsl(0_84%_88%)]',
	high: 'bg-[hsl(25_95%_96%)] text-[hsl(21_90%_35%)] border-[hsl(25_95%_88%)]',
	medium: 'bg-[hsl(48_96%_95%)] text-[hsl(32_80%_30%)] border-[hsl(48_96%_85%)]',
	low: 'bg-[hsl(142_76%_95%)] text-[hsl(142_60%_28%)] border-[hsl(142_76%_85%)]',
};

export function EscalationRow({ escalations }: EscalationRowProps) {
	if (!escalations.length) {
		return (
			<div className="flex items-center gap-2 rounded-md border border-dashed bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
				<Shield className="size-4 shrink-0" />
				No active escalation
			</div>
		);
	}

	return (
		<>
			{escalations.map((escalation) => (
				<div
					key={`${escalation.severity}-${escalation.reason}`}
					className={cn(
						'flex flex-wrap items-center gap-2 rounded-md border px-3 py-2',
						severityRowStyles[escalation.severity],
					)}
				>
					<AlertTriangle className="size-4 shrink-0" />
					<SeverityBadge severity={escalation.severity} />
					<span className="text-sm font-medium">{escalation.reason}</span>
					{escalation.suggested_action ? (
						<span className="ml-auto hidden text-xs text-muted-foreground sm:inline">
							→ {escalation.suggested_action}
						</span>
					) : null}
				</div>
			))}
		</>
	);
}
