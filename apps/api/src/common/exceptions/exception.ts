import { HttpException, HttpStatus } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

export interface ErrorDto {
	error: {
		code: string;
		message: string;
		details?: unknown;
	};
}

function prepareResponse(code: string, message: string, details?: unknown): ErrorDto {
	const response: ErrorDto = { error: { code, message } };

	if (details !== undefined) {
		response.error.details = details;
	}

	return response;
}

export class AppException extends HttpException {
	protected constructor(statusCode: number, code: string, message: string, details?: unknown) {
		super(prepareResponse(code, message, details), statusCode);
	}
}

export class AppBadRequestException extends AppException {
	constructor(message: string, details?: unknown) {
		super(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', message, details);
	}

	static fromValidationErrors(errors: ValidationError[]): AppBadRequestException {
		const details: Record<string, Record<string, string>> = {};

		function flatten(errs: ValidationError[], prefix: string): void {
			for (const err of errs) {
				const key = prefix ? `${prefix}.${err.property}` : err.property;

				if (err.constraints) {
					details[key] = err.constraints;
				}

				if (err.children && err.children.length > 0) {
					flatten(err.children, key);
				}
			}
		}

		flatten(errors, '');

		return new AppBadRequestException('Validation failed', details);
	}
}

export class AppUnauthorizedException extends AppException {
	constructor(message = 'Unauthorized') {
		super(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED', message);
	}
}

export class AppNotAllowedException extends AppException {
	constructor(message = 'Forbidden', details?: unknown) {
		super(HttpStatus.FORBIDDEN, 'FORBIDDEN', message, details);
	}
}

export class AppNotFoundException extends AppException {
	constructor(message = 'Not found') {
		super(HttpStatus.NOT_FOUND, 'NOT_FOUND', message);
	}
}

export class AppConflictException extends AppException {
	constructor(message: string, details?: unknown) {
		super(HttpStatus.CONFLICT, 'CONFLICT', message, details);
	}
}

export class AppNotRouteFoundError extends AppException {
	constructor(message = 'Route not found') {
		super(HttpStatus.NOT_FOUND, 'NOT_FOUND', message);
	}
}

export class AppInternalServerError extends AppException {
	constructor(message = 'Internal Server Error') {
		super(HttpStatus.INTERNAL_SERVER_ERROR, 'INTERNAL_ERROR', message);
	}
}

export class AppServiceUnavailableServerError extends AppException {
	constructor(message = 'Service unavailable') {
		super(HttpStatus.SERVICE_UNAVAILABLE, 'SERVICE_UNAVAILABLE', message);
	}
}
