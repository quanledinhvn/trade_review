import { cn } from '@/lib/utils';

interface EmptyStateProps {
	title: string;
	description?: string;
	className?: string;
}

export function EmptyState({ title, description, className }: EmptyStateProps) {
	return (
		<div
			className={cn(
				'rounded-lg border border-dashed bg-muted/20 px-6 py-12 text-center text-muted-foreground',
				className,
			)}
		>
			<p className="text-sm">{title}</p>
			{description ? <p className="mt-1 text-xs">{description}</p> : null}
		</div>
	);
}
