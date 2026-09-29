import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { AgentRun } from './entities/agent-run.entity';
import { RunEvidence } from './entities/run-evidence.entity';
import { Workspace } from '../workspaces/entities/workspace.entity';
import { EvidenceService } from '../evidence/evidence.service';
import { SignalService } from '../signals/signal.service';
import { BriefService } from '../briefs/brief.service';
import { AnalysisWorkflow } from '../analysis/analysis.workflow';
import { LlmRunner } from '../llm/llm-runner.service';
import {
  SytadelIdentityService,
  SytadelPrincipal,
} from '../identity/sytadel-identity.service';
import { SYTADEL_SCOPES } from '../identity/scopes';
import { AppConfig } from '../../config/configuration';
import {
  AgentRole,
  ExecutorKind,
  RunStage,
  RunStatus,
} from '../../common/enums';
import {
  BudgetExceededError,
  ReferenceIntegrityError,
} from '../../common/errors';
import { InvalidModelOutputError } from '../../common/util/json';
import { LlmProviderError, LlmUsage } from '../llm/llm-provider.interface';
import { PageParams } from '../../common/pagination';
import { PROMPT_VERSION, WORKFLOW_VERSION } from '../analysis/prompts';

export type StartRunInput = {
  workspace: Workspace;
  evidenceIds: string[];
  idempotencyKey: string;
  executorId: string;
};

@Injectable()
export class RunOrchestrator {
  private readonly logger = new Logger(RunOrchestrator.name);
  private readonly tokenBudget: number;

  constructor(
    @InjectRepository(AgentRun)
    private readonly runs: Repository<AgentRun>,
    @InjectRepository(RunEvidence)
    private readonly runEvidence: Repository<RunEvidence>,
    private readonly evidence: EvidenceService,
    private readonly signals: SignalService,
    private readonly briefs: BriefService,
    private readonly workflow: AnalysisWorkflow,
    private readonly runner: LlmRunner,
    private readonly identity: SytadelIdentityService,
    config: ConfigService,
  ) {
    this.tokenBudget = config.getOrThrow<AppConfig['run']>('run').tokenBudget;
  }

  /**
   * Start (or, on a repeated idempotency key, resume) a run over the given
   * already-ingested evidence, then execute it to completion.
   */
  async startRun(input: StartRunInput): Promise<AgentRun> {
    if (input.evidenceIds.length === 0) {
      throw new ReferenceIntegrityError('A run needs at least one evidence id');
    }

    // Resolve the Sytadel principal and enforce the read scope before creating
    // the run. When Sytadel auth is enabled this authenticates and requires
    // `research:read`; failures (auth or missing scope) throw and are visible —
    // we never silently fall back to local identity. When disabled it returns
    // null and the run keeps its local operator identity only.
    const principal = await this.identity.requireScope(
      SYTADEL_SCOPES.RESEARCH_READ,
    );

    const run = await this.getOrCreateRun(input, principal);
    await this.attachEvidence(run, input.workspace.id, input.evidenceIds);
    return this.execute(run.id);
  }

  /**
   * Resume a run from its last durable stage. Completed runs are returned
   * as-is (idempotent); failed or partial runs re-attempt the remaining steps
   * without redoing already-persisted work.
   */
  async execute(runId: string): Promise<AgentRun> {
    let run = await this.getRun(runId);
    if (run.status === RunStatus.COMPLETED) return run;

    run = await this.update(run, {
      status: RunStatus.RUNNING,
      startedAt: run.startedAt ?? new Date(),
      error: null,
    });

    try {
      const evidenceRows = await this.runEvidence.find({
        where: { runId: run.id },
        relations: { evidence: true },
        order: { position: 'ASC', createdAt: 'ASC', id: 'ASC' },
      });
      if (evidenceRows.length === 0) {
        throw new ReferenceIntegrityError('Run has no attached evidence');
      }
      const orderedEvidence = evidenceRows.map((r) => r.evidence);

      // --- Step 1: analysis → signals (skip if already persisted) ----------
      if (stageBefore(run.stage, RunStage.SIGNALS_PERSISTED)) {
        const { output, usage } = await this.workflow.analyze(
          orderedEvidence.map((e, i) => ({
            index: i + 1,
            sourceName: e.sourceName,
            sourceUrl: e.sourceUrl,
            content: e.content,
          })),
        );
        run = await this.accountUsage(run, usage);

        await this.signals.persistFromAnalysis(
          run.workspaceId,
          run.id,
          orderedEvidence.map((e) => ({ id: e.id, workspaceId: e.workspaceId })),
          output.signals,
        );
        run = await this.update(run, { stage: RunStage.SIGNALS_PERSISTED });
      }

      // --- Step 2: signals → Founder Brief (skip if already persisted) -----
      if (stageBefore(run.stage, RunStage.BRIEF_PERSISTED)) {
        const persistedSignals = await this.signals.listByRun(run.id);
        if (persistedSignals.length === 0) {
          throw new ReferenceIntegrityError(
            'No signals persisted; cannot write a brief',
          );
        }
        const { output, usage } = await this.workflow.writeBrief(
          persistedSignals.map((s, i) => ({
            index: i + 1,
            category: s.category,
            kind: s.kind,
            statement: s.statement,
          })),
        );
        run = await this.accountUsage(run, usage);

        await this.briefs.persistFromOutput(
          run.workspaceId,
          run.id,
          persistedSignals,
          output,
        );
        run = await this.update(run, { stage: RunStage.BRIEF_PERSISTED });
      }

      return this.update(run, {
        status: RunStatus.COMPLETED,
        finishedAt: new Date(),
      });
    } catch (err) {
      return this.fail(run, err);
    }
  }

  async getRun(runId: string): Promise<AgentRun> {
    const run = await this.runs.findOne({ where: { id: runId } });
    if (!run) throw new NotFoundException(`Run ${runId} not found`);
    return run;
  }

  async listRuns(
    workspaceId: string,
    page: PageParams,
    status?: RunStatus,
  ): Promise<AgentRun[]> {
    return this.runs.find({
      where: status ? { workspaceId, status } : { workspaceId },
      order: { createdAt: 'DESC', id: 'ASC' },
      take: page.limit,
      skip: page.offset,
    });
  }

  async countRuns(workspaceId: string): Promise<number> {
    return this.runs.count({ where: { workspaceId } });
  }

  // --- internals -----------------------------------------------------------

  private async getOrCreateRun(
    input: StartRunInput,
    principal: SytadelPrincipal | null,
  ): Promise<AgentRun> {
    const existing = await this.runs.findOne({
      where: {
        workspaceId: input.workspace.id,
        idempotencyKey: input.idempotencyKey,
      },
    });
    if (existing) return existing;

    const draft = this.runs.create({
      workspaceId: input.workspace.id,
      idempotencyKey: input.idempotencyKey,
      executorId: input.executorId,
      executorKind: ExecutorKind.LOCAL,
      sytadelSubject: principal?.serviceAccountId ?? null,
      sytadelTenantId: principal?.tenantId ?? null,
      agentRole: AgentRole.MARKET_RESEARCH,
      workflowVersion: WORKFLOW_VERSION,
      promptVersion: PROMPT_VERSION,
      provider: this.runner.providerId,
      model: this.runner.model,
      status: RunStatus.PENDING,
      stage: RunStage.CREATED,
    });

    try {
      return await this.runs.save(draft);
    } catch (err) {
      if (err instanceof QueryFailedError) {
        const found = await this.runs.findOne({
          where: {
            workspaceId: input.workspace.id,
            idempotencyKey: input.idempotencyKey,
          },
        });
        if (found) return found;
      }
      throw err;
    }
  }

  private async attachEvidence(
    run: AgentRun,
    workspaceId: string,
    evidenceIds: string[],
  ): Promise<void> {
    const unique = [...new Set(evidenceIds)];
    for (const evidenceId of unique) {
      const found = await this.evidence.findByIdInWorkspace(
        workspaceId,
        evidenceId,
      );
      if (!found) {
        throw new ReferenceIntegrityError(
          `Evidence ${evidenceId} not found in this workspace`,
        );
      }
    }
    if (unique.length === 0) return;

    await this.runEvidence
      .createQueryBuilder()
      .insert()
      .into(RunEvidence)
      .values(
        unique.map((evidenceId, position) => ({
          runId: run.id,
          evidenceId,
          workspaceId,
          position,
        })),
      )
      .orIgnore() // idempotent: (run_id, evidence_id) unique
      .execute();

    if (stageBefore(run.stage, RunStage.EVIDENCE_READY)) {
      await this.update(run, { stage: RunStage.EVIDENCE_READY });
    }
  }

  private async accountUsage(
    run: AgentRun,
    usage: LlmUsage,
  ): Promise<AgentRun> {
    const updated = await this.update(run, {
      inputTokens: run.inputTokens + usage.inputTokens,
      outputTokens: run.outputTokens + usage.outputTokens,
    });
    const total = updated.inputTokens + updated.outputTokens;
    if (total > this.tokenBudget) {
      throw new BudgetExceededError(
        `Run exceeded token budget (${total} > ${this.tokenBudget})`,
      );
    }
    return updated;
  }

  private async fail(run: AgentRun, err: unknown): Promise<AgentRun> {
    const message = sanitizeError(err);
    this.logger.warn(`Run ${run.id} failed: ${message}`);
    return this.update(run, {
      status: RunStatus.FAILED,
      finishedAt: new Date(),
      error: message,
    });
  }

  private async update(
    run: AgentRun,
    patch: Partial<AgentRun>,
  ): Promise<AgentRun> {
    Object.assign(run, patch);
    return this.runs.save(run);
  }
}

/** True if `stage` is strictly before `target` in the pipeline order. */
function stageBefore(stage: RunStage, target: RunStage): boolean {
  const order = [
    RunStage.CREATED,
    RunStage.EVIDENCE_READY,
    RunStage.SIGNALS_PERSISTED,
    RunStage.BRIEF_PERSISTED,
  ];
  return order.indexOf(stage) < order.indexOf(target);
}

/**
 * Produce a stable, safe failure message. Known domain/provider errors carry
 * already-sanitized messages; anything else collapses to a generic string so a
 * raw payload, secret, or source snippet can never leak into a persisted run.
 */
function sanitizeError(err: unknown): string {
  if (
    err instanceof LlmProviderError ||
    err instanceof InvalidModelOutputError ||
    err instanceof ReferenceIntegrityError ||
    err instanceof BudgetExceededError
  ) {
    return `${err.name}: ${err.message}`;
  }
  return 'Run failed: unexpected error';
}
