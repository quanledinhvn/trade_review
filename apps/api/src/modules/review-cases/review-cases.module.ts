import { Module, forwardRef } from '@nestjs/common';
import { ActorContextGuard } from '../../common/auth';
import { PrismaModule } from '../../database/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { TasksModule } from '../tasks/tasks.module';
import { ReviewCasesController } from './review-cases.controller';
import { ReviewCasesService } from './review-cases.service';
import { RuleEngineService } from './rule-engine.service';

@Module({
	imports: [PrismaModule, AuditModule, forwardRef(() => TasksModule)],
	controllers: [ReviewCasesController],
	providers: [ReviewCasesService, RuleEngineService, ActorContextGuard],
	exports: [ReviewCasesService],
})
export class ReviewCasesModule {}
