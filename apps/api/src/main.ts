import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { AppModule } from './app.module';
import { AppBadRequestException } from './common/exceptions/exception';

async function bootstrap() {
	const app = await NestFactory.create(AppModule, { bufferLogs: true });

	app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

	app.setGlobalPrefix('api');

	app.enableCors();

	app.useGlobalPipes(
		new ValidationPipe({
			whitelist: true,
			forbidNonWhitelisted: true,
			transform: true,
			exceptionFactory: (errors) => AppBadRequestException.fromValidationErrors(errors),
		}),
	);

	const configService = app.get(ConfigService);
	const port = configService.getOrThrow<number>('app.port');

	await app.listen(port);

	const logger = app.get(WINSTON_MODULE_NEST_PROVIDER);

	logger.log(`API ready on http://localhost:${port}/api`, 'Bootstrap');
}

void bootstrap();
