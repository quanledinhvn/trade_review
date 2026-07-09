import type request from 'supertest';

export function withActorHeaders(
	req: request.Test,
	overrides: Partial<{ actorId: string; actorTeam: string }> = {},
): request.Test {
	const actorId = overrides.actorId ?? 'system';
	const actorTeam = overrides.actorTeam ?? 'trade_operations';

	return req.set('X-Actor-Id', actorId).set('X-Actor-Team', actorTeam);
}
