import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
	use(req: Request, res: Response, next: NextFunction): void {
		const incoming = req.headers['x-request-id'];
		const requestId = typeof incoming === 'string' && incoming.length > 0 ? incoming : randomUUID();

		req.requestId = requestId;

		res.setHeader('x-request-id', requestId);

		next();
	}
}
