import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration';
import { LlmRunner } from '../llm/llm-runner.service';
import { LlmUsage } from '../llm/llm-provider.interface';
import { parseModelJson } from '../../common/util/json';
import {
  AssessmentOutput,
  assessmentOutputSchema,
} from './schemas/assessment.schema';
import {
  AccountForAssessment,
  buildAssessmentSystemPrompt,
  buildAssessmentUserPrompt,
  IcpForAssessment,
} from './account.prompts';

/**
 * Deterministic account-vs-ICP assessment around the model call: fixed versioned
 * prompt → model (bounded retries/timeout) → parse + schema-validate. Invalid
 * output is a hard error, never a fallback.
 */
@Injectable()
export class AccountAssessmentWorkflow {
  private readonly llm: AppConfig['llm'];

  constructor(
    private readonly runner: LlmRunner,
    config: ConfigService,
  ) {
    this.llm = config.getOrThrow<AppConfig['llm']>('llm');
  }

  async assess(
    icp: IcpForAssessment,
    account: AccountForAssessment,
  ): Promise<{ output: AssessmentOutput; usage: LlmUsage }> {
    const res = await this.runner.complete(
      {
        system: buildAssessmentSystemPrompt(),
        user: buildAssessmentUserPrompt(icp, account),
        maxTokens: this.llm.maxTokens,
        timeoutMs: this.llm.timeoutMs,
        temperature: 0,
      },
      this.llm.maxRetries,
    );
    return {
      output: parseModelJson(res.text, assessmentOutputSchema),
      usage: res.usage,
    };
  }
}
