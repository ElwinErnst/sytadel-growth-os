import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IcpProfile, IcpContent } from './entities/icp-profile.entity';
import { IcpWorkflow } from './icp.workflow';
import { renderIcpMarkdown } from './icp-renderer';
import { SignalService } from '../signals/signal.service';
import { MarketSignal } from '../signals/entities/market-signal.entity';
import { SytadelIdentityService } from '../identity/sytadel-identity.service';
import { SYTADEL_SCOPES } from '../identity/scopes';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../../common/enums';
import { ReferenceIntegrityError } from '../../common/errors';

/** Max signals fed to one synthesis. */
const SIGNAL_CAP = 100;

/** Raised when there is nothing to synthesize an ICP from. */
export class NoSignalsError extends Error {
  constructor() {
    super('No signals in this workspace; run `analyze` first.');
    this.name = 'NoSignalsError';
  }
}

@Injectable()
export class IcpService {
  constructor(
    @InjectRepository(IcpProfile)
    private readonly repo: Repository<IcpProfile>,
    private readonly signals: SignalService,
    private readonly workflow: IcpWorkflow,
    private readonly identity: SytadelIdentityService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Synthesize and persist a new ICP version for a workspace from its signals.
   * Read/analysis action → requires `research:read` when Sytadel auth is on.
   */
  async generate(workspaceId: string, executorId: string): Promise<IcpProfile> {
    const principal = await this.identity.requireScope(
      SYTADEL_SCOPES.RESEARCH_READ,
    );

    const signals = await this.signals.listByWorkspace(workspaceId, SIGNAL_CAP);
    if (signals.length === 0) throw new NoSignalsError();

    const { output } = await this.workflow.synthesize(
      signals.map((s, i) => ({
        index: i + 1,
        category: s.category,
        kind: s.kind,
        statement: s.statement,
      })),
    );

    const content: IcpContent = {
      summary: output.summary.trim(),
      segments: output.segments.map((seg) => ({
        name: seg.name.trim(),
        description: seg.description.trim(),
        signalIds: this.resolveRefs(seg.signalRefs, signals),
      })),
      idealCharacteristics: output.idealCharacteristics.map((s) => s.trim()),
      keyPains: output.keyPains.map((p) => ({
        pain: p.pain.trim(),
        signalIds: this.resolveRefs(p.signalRefs, signals),
      })),
      disqualifiers: output.disqualifiers.map((s) => s.trim()),
      recommendedBeachhead: output.recommendedBeachhead.trim(),
      hypothesesToValidate: output.hypothesesToValidate.map((s) => s.trim()),
      uncertainty: output.uncertainty.map((s) => s.trim()),
    };

    const title = output.title.trim();
    const version = (await this.latestVersion(workspaceId)) + 1;
    const bodyMarkdown = renderIcpMarkdown(title, content, signals);

    const profile = await this.repo.save(
      this.repo.create({
        workspaceId,
        version,
        title,
        content,
        bodyMarkdown,
        sourceSignalCount: signals.length,
      }),
    );

    await this.audit.record({
      workspaceId,
      action: AuditAction.ICP_GENERATED,
      actor: {
        executorId,
        sytadelSubject: principal?.serviceAccountId ?? null,
        tenantId: principal?.tenantId ?? null,
      },
      metadata: { icpVersion: version, sourceSignalCount: signals.length },
    });

    return profile;
  }

  async getLatest(workspaceId: string): Promise<IcpProfile | null> {
    return this.repo.findOne({
      where: { workspaceId },
      order: { version: 'DESC' },
    });
  }

  async getVersion(
    workspaceId: string,
    version: number,
  ): Promise<IcpProfile | null> {
    return this.repo.findOne({ where: { workspaceId, version } });
  }

  // --- internals -----------------------------------------------------------

  /** Map 1-based signalRefs to real signal ids; reject invented references. */
  private resolveRefs(refs: number[], signals: MarketSignal[]): string[] {
    return refs.map((ref) => {
      const signal = signals[ref - 1];
      if (!signal) {
        throw new ReferenceIntegrityError(
          `ICP cites signalRef ${ref}, but only ${signals.length} signal(s) were supplied`,
        );
      }
      return signal.id;
    });
  }

  private async latestVersion(workspaceId: string): Promise<number> {
    const latest = await this.getLatest(workspaceId);
    return latest?.version ?? 0;
  }
}
