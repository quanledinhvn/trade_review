import { registerAs } from '@nestjs/config';
import * as winston from 'winston';
import type { WinstonModuleOptions } from 'nest-winston';

export const logConfig = registerAs('log', (): WinstonModuleOptions => {
	const nodeEnv = process.env.NODE_ENV ?? 'development';
	const logLevel = process.env.LOG_LEVEL ?? (nodeEnv === 'production' ? 'info' : 'debug');

	return {
		level: logLevel,
		defaultMeta: { service: 'api', env: nodeEnv },
		transports: [
			new winston.transports.Console({
				format:
					nodeEnv === 'production'
						? winston.format.combine(winston.format.timestamp(), winston.format.json())
						: winston.format.combine(winston.format.colorize(), winston.format.simple()),
			}),
		],
	};
});
