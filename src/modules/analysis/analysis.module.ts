import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { AnalysisWorkflow } from './analysis.workflow';

@Module({
  imports: [LlmModule],
  providers: [AnalysisWorkflow],
  exports: [AnalysisWorkflow],
})
export class AnalysisModule {}
