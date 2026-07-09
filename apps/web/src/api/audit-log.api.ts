import { api } from '@/lib/api';
import type { AuditLogEntry, Paginated } from '../types';

type AuditLogResponse = AuditLogEntry[] | Paginated<AuditLogEntry>;

function normalizeAuditLogResponse(data: AuditLogResponse): AuditLogEntry[] {
	if (Array.isArray(data)) {
		return data;
	}

	return data.items;
}

export function fetchAuditLog(caseRef: string): Promise<AuditLogEntry[]> {
	return (
		api.get(`/review-cases/${encodeURIComponent(caseRef)}/audit-log`) as Promise<AuditLogResponse>
	).then(normalizeAuditLogResponse);
}
