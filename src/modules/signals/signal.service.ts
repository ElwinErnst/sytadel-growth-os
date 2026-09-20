import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarketSignal } from './entities/market-signal.entity';
import { AnalysisSignal } from '../llm/schemas/analysis.schema';
import { fingerprint } from '../../common/util/hash';
import { ReferenceIntegrityError } from '../../common/errors';

/** Ordered evidence handed to the model: index i (0-based) → evidence id. */
export type EvidenceRefMap = Array<{ id: string; workspaceId: string }>;

@Injectable()
export class SignalService {
  constructor(
    @InjectRepository(MarketSignal)
    private readonly repo: Repository<MarketSignal>,
  ) {}

  /**
   * Persist validated analysis signals for a run. Each signal's `evidenceRef`
   * (1-based) must map to a piece of evidence actually supplied to the run and
   * belonging to the same workspace — otherwise the model invented a reference
   * and the whole step fails. Deduplicated per run by fingerprint via an
   * idempotent (orIgnore) insert, so retries and concurrency never duplicate.
   */
  async persistFromAnalysis(
    workspaceId: string,
    runId: string,
    evidence: EvidenceRefMap,
    signals: AnalysisSignal[],
  ): Promise<MarketSignal[]> {
    const rows = signals.map((s) => {
      const idx = s.evidenceRef - 1;
      const ref = evidence[idx];
      if (!ref) {
        throw new ReferenceIntegrityError(
          `Signal cites evidenceRef ${s.evidenceRef}, but only ${evidence.length} evidence item(s) were supplied to the run`,
        );
      }
      // Defense in depth: the run-evidence list is already workspace-scoped,
      // but never persist a cross-workspace reference.
      if (ref.workspaceId !== workspaceId) {
        throw new ReferenceIntegrityError(
          'Signal references evidence from another workspace',
        );
      }
      return {
        workspaceId,
        runId,
        evidenceId: ref.id,
        category: s.category,
        kind: s.kind,
        statement: s.statement.trim(),
        evidenceQuote: s.evidenceQuote?.trim() || null,
        confidence: s.confidence,
        fingerprint: fingerprint(s.statement),
      };
    });

    if (rows.length > 0) {
      await this.repo
        .createQueryBuilder()
        .insert()
        .into(MarketSignal)
        .values(rows)
        .orIgnore() // dedup on (run_id, fingerprint)
        .execute();
    }

    return this.listByRun(runId);
  }

  async listByRun(runId: string): Promise<MarketSignal[]> {
    return this.repo.find({
      where: { runId },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
  }

  async countByWorkspace(workspaceId: string): Promise<number> {
    return this.repo.count({ where: { workspaceId } });
  }
}
