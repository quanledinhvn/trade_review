import type { ActorContext } from '../../domain/actor';

declare global {
	namespace Express {
		interface Request {
			requestId: string;
			actor?: ActorContext;
		}
	}
}

export {};
