import { ArgumentsHost, Catch, ExceptionFilter, Inject, NotFoundException } from '@nestjs/common';
import { Request, Response } from 'express';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import {
	AppException,
	AppInternalServerError,
	AppNotRouteFoundError,
	ErrorDto,
} from '../exceptions/exception';

@Catch()
export class GlobalHandleExceptionFilter implements ExceptionFilter {
	constructor(
		@Inject(WINSTON_MODULE_PROVIDER)
		private readonly logger: Logger,
	) {}

	catch(exception: unknown, host: ArgumentsHost) {
		const ctx = host.switchToHttp();
		const req = ctx.getRequest<Request>();
		const res = ctx.getResponse<Response>();

		let appException: AppException;
		let extraData: unknown;

		if (exception instanceof AppException) {
			appException = exception;
		} else if (exception instanceof NotFoundException) {
			appException = new AppNotRouteFoundError();
		} else {
			const stack = exception instanceof Error ? exception.stack : String(exception);

			extraData = process.env.ENABLE_VERBOSE_ERR_RESPONSE === 'true' ? stack : undefined;

			appException = new AppInternalServerError();
		}

		const body = appException.getResponse() as ErrorDto;
		const status = appException.getStatus();

		if (status >= 500) {
			this.logger.error({
				message: 'Request failed',
				requestId: req.requestId,
				error:
					exception instanceof Error
						? { message: exception.message, stack: exception.stack }
						: String(exception),
				http: { status, method: req.method, url: req.originalUrl },
			});
		}

		const responseBody: ErrorDto =
			extraData !== undefined ? { error: { ...body.error, details: extraData } } : body;

		res.status(status).json(responseBody);
	}
}
