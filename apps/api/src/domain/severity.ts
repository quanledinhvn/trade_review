export const SEVERITY_LEVEL = {
	CRITICAL: 'critical',
	HIGH: 'high',
	MEDIUM: 'medium',
	LOW: 'low',
} as const;

export type Severity = (typeof SEVERITY_LEVEL)[keyof typeof SEVERITY_LEVEL];

export type RiskLevel = Severity;

export const SEVERITY_RANK: Record<Severity, number> = {
	[SEVERITY_LEVEL.CRITICAL]: 40,
	[SEVERITY_LEVEL.HIGH]: 30,
	[SEVERITY_LEVEL.MEDIUM]: 20,
	[SEVERITY_LEVEL.LOW]: 10,
};
