import { AppBadRequestException, AppNotAllowedException } from '../common/exceptions/exception';

export interface ActorContext {
	actorId: string;
	actorTeam: string;
}

export function parseActorContext(actorId?: string, actorTeam?: string): ActorContext {
	if (!actorId?.trim() || !actorTeam?.trim()) {
		throw new AppBadRequestException('X-Actor-Id and X-Actor-Team headers are required', {
			'x-actor-id': actorId ? undefined : 'required',
			'x-actor-team': actorTeam ? undefined : 'required',
		});
	}

	return { actorId: actorId.trim(), actorTeam: actorTeam.trim() };
}

export function assertActorOnAssignedTeam(
	actor: ActorContext,
	assignedTeam: string,
	assignedUser?: string | null,
): void {
	if (actor.actorTeam !== assignedTeam) {
		throw new AppNotAllowedException('Actor is not authorized for this task', {
			actor_team: actor.actorTeam,
			assigned_team: assignedTeam,
		});
	}

	if (assignedUser && actor.actorId !== assignedUser) {
		throw new AppNotAllowedException('Task is assigned to another user', {
			actor_id: actor.actorId,
			assigned_user: assignedUser,
		});
	}
}
