import type { Severity } from './severity';

export interface RuleSnapshot {
	ruleId: string;
	version: number;
	severity: Severity;
	threshold?: number;
	title: string;
	suggestedAction: string;
}
