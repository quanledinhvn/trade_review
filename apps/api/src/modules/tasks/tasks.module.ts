import { Module, forwardRef } from '@nestjs/common';
import { ActorContextGuard } from '../../common/auth';
import { PrismaModule } from '../../database/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { ReviewCasesModule } from '../review-cases/review-cases.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
	imports: [PrismaModule, AuditModule, forwardRef(() => ReviewCasesModule)],
	controllers: [TasksController],
	providers: [TasksService, ActorContextGuard],
	exports: [TasksService],
})
export class TasksModule {}
