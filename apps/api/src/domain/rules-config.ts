import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Severity } from './severity';

export type RuleTrigger =
	| 'missing_document'
	| 'wood_uncertified'
	| 'high_value'
	| 'deadline_approaching'
	| 'deadline_passed';

export interface RuleWhen {
	trigger: RuleTrigger;
	params: Record<string, unknown>;
}

export interface RuleTaskOutcome {
	severity: Severity;
	title: string;
	description: string;
	suggestedAction: string;
	assignedTeam: string;
}

export interface RuleEscalationOutcome {
	type: string;
	severity: Severity;
	reason: string;
	suggestedAction: string;
}

export interface RuleDefinition {
	ruleId: string;
	version: number;
	enabled: boolean;
	reason: string;
	when: RuleWhen;
	task?: RuleTaskOutcome;
	escalation?: RuleEscalationOutcome;
}

export function loadRulesConfig(): RuleDefinition[] {
	const raw = readFileSync(join(__dirname, '..', 'config', 'rules.config.json'), 'utf-8');

	return JSON.parse(raw) as RuleDefinition[];
}
