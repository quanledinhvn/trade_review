import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { parseActorContext } from '../../domain/actor';

@Injectable()
export class ActorContextGuard implements CanActivate {
	canActivate(context: ExecutionContext): boolean {
		const request = context.switchToHttp().getRequest<Request>();

		request.actor = parseActorContext(
			headerValue(request.headers['x-actor-id']),
			headerValue(request.headers['x-actor-team']),
		);

		return true;
	}
}

function headerValue(value: string | string[] | undefined): string | undefined {
	if (Array.isArray(value)) {
		return value[0];
	}

	return value;
}
