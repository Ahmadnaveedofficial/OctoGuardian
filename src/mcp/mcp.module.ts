import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { McpService } from './mcp.service';
import { McpController } from './mcp.controller';
import { RiskEvaluatorService } from './risk-evaluator.service';
import {
  PendingAction,
  PendingActionSchema,
} from './schemas/pending-action.schema';
import { GitHubModule } from '../github/github.module';
import { AuditModule } from '../audit/audit.module';
import { GeminiModule } from '../gemini/gemini.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PendingAction.name, schema: PendingActionSchema },
    ]),
    GitHubModule,
    AuditModule,
    forwardRef(() => GeminiModule),
  ],
  controllers: [McpController],
  providers: [McpService, RiskEvaluatorService],
  exports: [McpService, RiskEvaluatorService],
})
export class McpModule {}
