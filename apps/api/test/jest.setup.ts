import type { INestApplication, Type } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { useContainer } from 'class-validator';
import type { ValidationError } from 'class-validator';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { AppModule } from '../src/app.module';
import { AppBadRequestException } from '../src/common/exceptions/exception';
import { PrismaService } from '../src/database/prisma.service';

export interface ITestContext {
	app: INestApplication;
	module: TestingModule;
}

export interface ITestAppOptions {
	beforeAppInit?: (app: INestApplication) => void;
}

declare global {
	var testContext: ITestContext;
}

function setupAppTest(MainModule: Type<unknown> = AppModule, options?: ITestAppOptions): void {
	beforeAll(async () => {
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [MainModule],
		}).compile();

		const testApp: INestApplication = moduleFixture.createNestApplication({ bufferLogs: true });

		testApp.useLogger(testApp.get(WINSTON_MODULE_NEST_PROVIDER));

		options?.beforeAppInit?.(testApp);

		testApp.useGlobalPipes(
			new ValidationPipe({
				whitelist: true,
				forbidNonWhitelisted: true,
				transform: true,
				exceptionFactory: (errors: ValidationError[]): AppBadRequestException =>
					AppBadRequestException.fromValidationErrors(errors),
			}),
		);

		testApp.setGlobalPrefix('api');

		await testApp.init();

		await testApp.listen(0);

		useContainer(testApp.select(MainModule), {
			fallbackOnErrors: true,
		});

		global.testContext = {
			app: testApp,
			module: moduleFixture,
		};
	});

	afterEach(async () => {
		if (global.testContext) {
			const prisma = global.testContext.app.get(PrismaService);

			await prisma.auditLog.deleteMany();

			await prisma.task.deleteMany();

			await prisma.escalation.deleteMany();

			await prisma.reviewCase.deleteMany();
		}
	}, 60000);

	afterAll(async () => {
		if (global.testContext) {
			await global.testContext.app.close();
		}
	});
}

setupAppTest();
