import {
	ClassSerializerInterceptor,
	MiddlewareConsumer,
	Module,
	NestModule,
	RequestMethod,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { WinstonModule, WinstonModuleOptions } from 'nest-winston';
import { appConfig } from './config/app.config';
import { logConfig } from './config/log.config';
import { GlobalHandleExceptionFilter } from './common/filters/exception.filter';
import { AccessLogMiddleware } from './common/middleware/access-log.middleware';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { PrismaModule } from './database/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { ReviewCasesModule } from './modules/review-cases/review-cases.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { WorkQueueModule } from './modules/work-queue/work-queue.module';

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			load: [appConfig, logConfig],
			cache: true,
		}),
		WinstonModule.forRootAsync({
			imports: [ConfigModule],
			useFactory: (config: ConfigService) => config.getOrThrow<WinstonModuleOptions>('log'),
			inject: [ConfigService],
		}),
		PrismaModule,
		HealthModule,
		ReviewCasesModule,
		TasksModule,
		WorkQueueModule,
	],
	providers: [
		RequestIdMiddleware,
		AccessLogMiddleware,
		{
			provide: APP_FILTER,
			useClass: GlobalHandleExceptionFilter,
		},
		{
			provide: APP_INTERCEPTOR,
			useClass: ClassSerializerInterceptor,
		},
	],
})
export class AppModule implements NestModule {
	configure(consumer: MiddlewareConsumer): void {
		consumer
			.apply(RequestIdMiddleware, AccessLogMiddleware)
			.forRoutes({ path: '*path', method: RequestMethod.ALL });
	}
}
