import type { AuditLogEntry } from '../types';
import { AuditActionBadge } from './audit-action-badge';

function formatAuditTime(iso: string): string {
	return new Date(iso).toLocaleString('en-GB', {
		dateStyle: 'medium',
		timeStyle: 'short',
	});
}

interface AuditLogEntryRowProps {
	entry: AuditLogEntry;
	isMostRecent?: boolean;
}

export function AuditLogEntryRow({ entry, isMostRecent = false }: AuditLogEntryRowProps) {
	const entityLabel = entry.entity_type
		? `${entry.entity_type}${entry.entity_id ? ` · ${entry.entity_id}` : ''}`
		: null;

	return (
		<div className={isMostRecent ? 'bg-muted/20 px-6 py-4' : 'px-6 py-4'}>
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="flex flex-wrap items-center gap-2">
					<AuditActionBadge action={entry.action} />
					{entityLabel ? (
						<span className="text-xs capitalize text-muted-foreground">{entityLabel}</span>
					) : null}
				</div>
				<time className="shrink-0 text-xs text-muted-foreground" dateTime={entry.created_at}>
					{formatAuditTime(entry.created_at)}
				</time>
			</div>
			<p className="mt-2 text-sm font-medium">{entry.summary}</p>
			<div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
				<span>
					Actor: <span className="font-medium text-foreground">{entry.actor}</span>
				</span>
			</div>
			{entry.before || entry.after ? (
				<div className="mt-3 grid gap-2 sm:grid-cols-2">
					{entry.before ? (
						<div className="rounded-md border bg-muted/30 px-3 py-2">
							<p className="mb-1 text-xs font-medium text-muted-foreground">Before</p>
							<pre className="whitespace-pre-wrap break-all text-xs">
								{JSON.stringify(entry.before, null, 2)}
							</pre>
						</div>
					) : null}
					{entry.after ? (
						<div className="rounded-md border bg-muted/30 px-3 py-2">
							<p className="mb-1 text-xs font-medium text-muted-foreground">After</p>
							<pre className="whitespace-pre-wrap break-all text-xs">
								{JSON.stringify(entry.after, null, 2)}
							</pre>
						</div>
					) : null}
				</div>
			) : null}
		</div>
	);
}
