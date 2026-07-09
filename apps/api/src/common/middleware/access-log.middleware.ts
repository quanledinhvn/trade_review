import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

@Injectable()
export class AccessLogMiddleware implements NestMiddleware {
	constructor(
		@Inject(WINSTON_MODULE_PROVIDER)
		private readonly logger: Logger,
	) {}

	use(req: Request, res: Response, next: NextFunction): void {
		if (this.shouldSkipAccessLog(req)) {
			next();

			return;
		}

		const start = Date.now();

		res.on('finish', () => {
			this.logAccess(req, res.statusCode, start);
		});

		next();
	}

	private shouldSkipAccessLog(req: Request): boolean {
		const path = req.originalUrl.split('?')[0];

		return req.method === 'GET' && path === '/api/health';
	}

	private logAccess(req: Request, statusCode: number, start: number): void {
		const payload = {
			message: 'HTTP access',
			requestId: req.requestId,
			http: {
				method: req.method,
				url: req.originalUrl,
				statusCode,
				durationMs: Date.now() - start,
				userAgent: req.headers['user-agent'],
				ip: req.ip || req.socket.remoteAddress,
			},
		};

		if (statusCode >= 500) {
			this.logger.error(payload);
		} else if (statusCode >= 400) {
			this.logger.warn(payload);
		} else {
			this.logger.info(payload);
		}
	}
}
