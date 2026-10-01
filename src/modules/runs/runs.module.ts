import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentRun } from './entities/agent-run.entity';
import { RunEvidence } from './entities/run-evidence.entity';
import { RunOrchestrator } from './run-orchestrator.service';
import { EvidenceModule } from '../evidence/evidence.module';
import { SignalsModule } from '../signals/signals.module';
import { BriefsModule } from '../briefs/briefs.module';
import { AnalysisModule } from '../analysis/analysis.module';
import { LlmModule } from '../llm/llm.module';
import { IdentityModule } from '../identity/identity.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AgentRun, RunEvidence]),
    EvidenceModule,
    SignalsModule,
    BriefsModule,
    AnalysisModule,
    LlmModule,
    IdentityModule,
    AuditModule,
  ],
  providers: [RunOrchestrator],
  exports: [RunOrchestrator],
})
export class RunsModule {}
