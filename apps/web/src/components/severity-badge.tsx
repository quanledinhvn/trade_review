import { cn } from '@/lib/utils';
import { SEVERITY_LABEL, type RiskLevel, type Severity } from '../types';

const severityStyles: Record<Severity, string> = {
	critical: 'bg-[hsl(0_84%_97%)] text-[hsl(0_72%_35%)] border-[hsl(0_84%_88%)]',
	high: 'bg-[hsl(25_95%_96%)] text-[hsl(21_90%_35%)] border-[hsl(25_95%_88%)]',
	medium: 'bg-[hsl(48_96%_95%)] text-[hsl(32_80%_30%)] border-[hsl(48_96%_85%)]',
	low: 'bg-[hsl(142_76%_95%)] text-[hsl(142_60%_28%)] border-[hsl(142_76%_85%)]',
};

interface SeverityBadgeProps {
	severity: Severity | RiskLevel;
	className?: string;
}

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
	return (
		<span
			className={cn(
				'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold',
				severityStyles[severity],
				className,
			)}
		>
			{SEVERITY_LABEL[severity]}
		</span>
	);
}
