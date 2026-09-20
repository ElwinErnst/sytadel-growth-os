import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  FounderBrief,
  FounderBriefContent,
} from './entities/founder-brief.entity';
import { MarketSignal } from '../signals/entities/market-signal.entity';
import { BriefOutput } from '../llm/schemas/brief.schema';
import { renderBriefMarkdown } from './brief-renderer';
import { ReferenceIntegrityError } from '../../common/errors';

@Injectable()
export class BriefService {
  constructor(
    @InjectRepository(FounderBrief)
    private readonly repo: Repository<FounderBrief>,
  ) {}

  /**
   * Build and persist the Founder Brief from a validated writer output and the
   * run's persisted signals. `signalRefs` (1-based) are resolved back to real
   * signal ids; a ref outside the signal list means the writer invented a
   * citation and the step fails. Idempotent on runId — re-running updates the
   * single brief row rather than creating a duplicate.
   */
  async persistFromOutput(
    workspaceId: string,
    runId: string,
    signals: MarketSignal[],
    output: BriefOutput,
  ): Promise<FounderBrief> {
    const content: FounderBriefContent = {
      findings: output.findings.map((f) => ({
        statement: f.statement.trim(),
        signalIds: f.signalRefs.map((ref) => {
          const signal = signals[ref - 1];
          if (!signal) {
            throw new ReferenceIntegrityError(
              `Brief finding cites signalRef ${ref}, but only ${signals.length} signal(s) exist for the run`,
            );
          }
          return signal.id;
        }),
      })),
      implicationsForSytadel: output.implicationsForSytadel.map((s) => s.trim()),
      hypothesesToValidate: output.hypothesesToValidate.map((s) => s.trim()),
      nextExperiment: output.nextExperiment.trim(),
      uncertaintyAndCoverage: output.uncertaintyAndCoverage.map((s) => s.trim()),
    };

    const title = output.title.trim();
    const bodyMarkdown = renderBriefMarkdown(title, content, signals);

    const existing = await this.repo.findOne({ where: { runId } });
    if (existing) {
      existing.title = title;
      existing.content = content;
      existing.bodyMarkdown = bodyMarkdown;
      return this.repo.save(existing);
    }

    return this.repo.save(
      this.repo.create({ workspaceId, runId, title, content, bodyMarkdown }),
    );
  }

  async findByRun(runId: string): Promise<FounderBrief | null> {
    return this.repo.findOne({ where: { runId } });
  }
}
