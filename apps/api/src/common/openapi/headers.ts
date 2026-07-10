import { applyDecorators } from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';

export function ApiRequestIdHeader(): MethodDecorator & ClassDecorator {
	return applyDecorators(
		ApiHeader({
			name: 'X-Request-Id',
			required: false,
			description: 'Optional request correlation ID. The API echoes it in the response.',
		}),
	);
}

export function ApiActorHeaders(): MethodDecorator & ClassDecorator {
	return applyDecorators(
		ApiHeader({
			name: 'X-Actor-Id',
			required: true,
			description: 'Actor identifier used for audit log attribution.',
			example: 'system',
		}),
		ApiHeader({
			name: 'X-Actor-Team',
			required: true,
			description: 'Actor team used for authorization against assigned work.',
			example: 'trade_operations',
		}),
	);
}
