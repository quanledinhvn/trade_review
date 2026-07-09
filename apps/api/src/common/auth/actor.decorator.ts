import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';
import type { ActorContext } from '../../domain/actor';

export const Actor = createParamDecorator(
	(_data: unknown, context: ExecutionContext): ActorContext => {
		const request = context.switchToHttp().getRequest<Request>();

		return request.actor!;
	},
);
