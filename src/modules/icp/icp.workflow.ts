import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration';
import { LlmRunner } from '../llm/llm-runner.service';
import { LlmUsage } from '../llm/llm-provider.interface';
import { parseModelJson } from '../../common/util/json';
import { IcpOutput, icpOutputSchema } from './schemas/icp.schema';
import {
  buildIcpSystemPrompt,
  buildIcpUserPrompt,
  SignalForIcp,
} from './icp.prompts';

/**
 * Deterministic ICP synthesis around the model call: fixed versioned prompt →
 * model (bounded retries/timeout in LlmRunner) → parse + schema-validate.
 * Invalid output is a hard error, never a fallback.
 */
@Injectable()
export class IcpWorkflow {
  private readonly llm: AppConfig['llm'];

  constructor(
    private readonly runner: LlmRunner,
    config: ConfigService,
  ) {
    this.llm = config.getOrThrow<AppConfig['llm']>('llm');
  }

  async synthesize(
    signals: SignalForIcp[],
  ): Promise<{ output: IcpOutput; usage: LlmUsage }> {
    const res = await this.runner.complete(
      {
        system: buildIcpSystemPrompt(),
        user: buildIcpUserPrompt(signals),
        maxTokens: this.llm.maxTokens,
        timeoutMs: this.llm.timeoutMs,
        temperature: 0,
      },
      this.llm.maxRetries,
    );
    return {
      output: parseModelJson(res.text, icpOutputSchema),
      usage: res.usage,
    };
  }
}
