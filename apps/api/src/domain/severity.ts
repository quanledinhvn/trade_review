export const RISK_LEVEL = {
	CRITICAL: 'critical',
	HIGH: 'high',
	MEDIUM: 'medium',
	LOW: 'low',
} as const;

export type Severity = (typeof RISK_LEVEL)[keyof typeof RISK_LEVEL];

export type RiskLevel = Severity;

export const SEVERITY_RANK: Record<Severity, number> = {
	critical: 40,
	high: 30,
	medium: 20,
	low: 10,
};

export function severityRank(severity: Severity): number {
	return SEVERITY_RANK[severity];
}
