import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration';
import { LlmRunner } from '../llm/llm-runner.service';
import { LlmUsage } from '../llm/llm-provider.interface';
import { parseModelJson } from '../../common/util/json';
import {
  AnalysisOutput,
  analysisOutputSchema,
} from '../llm/schemas/analysis.schema';
import { BriefOutput, briefOutputSchema } from '../llm/schemas/brief.schema';
import {
  buildAnalysisSystemPrompt,
  buildAnalysisUserPrompt,
  buildBriefSystemPrompt,
  buildBriefUserPrompt,
  EvidenceForPrompt,
  SignalForPrompt,
} from './prompts';

export type StepResult<T> = { output: T; usage: LlmUsage };

/**
 * The market-research workflow, expressed as deterministic steps around the
 * model call. Each step: build a fixed prompt → call the model (bounded
 * retries/timeout in LlmRunner) → parse + schema-validate the JSON output.
 * Invalid output is a hard error (InvalidModelOutputError), never a fallback.
 *
 * The analyst and writer are steps of the SAME workflow, not separate services
 * — the plan calls for roles, not microservices.
 */
@Injectable()
export class AnalysisWorkflow {
  private readonly llm: AppConfig['llm'];

  constructor(
    private readonly runner: LlmRunner,
    config: ConfigService,
  ) {
    this.llm = config.getOrThrow<AppConfig['llm']>('llm');
  }

  async analyze(
    evidence: EvidenceForPrompt[],
  ): Promise<StepResult<AnalysisOutput>> {
    const res = await this.runner.complete(
      {
        system: buildAnalysisSystemPrompt(),
        user: buildAnalysisUserPrompt(evidence),
        maxTokens: this.llm.maxTokens,
        timeoutMs: this.llm.timeoutMs,
        temperature: 0,
      },
      this.llm.maxRetries,
    );
    return {
      output: parseModelJson(res.text, analysisOutputSchema),
      usage: res.usage,
    };
  }

  async writeBrief(
    signals: SignalForPrompt[],
  ): Promise<StepResult<BriefOutput>> {
    const res = await this.runner.complete(
      {
        system: buildBriefSystemPrompt(),
        user: buildBriefUserPrompt(signals),
        maxTokens: this.llm.maxTokens,
        timeoutMs: this.llm.timeoutMs,
        temperature: 0,
      },
      this.llm.maxRetries,
    );
    return {
      output: parseModelJson(res.text, briefOutputSchema),
      usage: res.usage,
    };
  }
}
