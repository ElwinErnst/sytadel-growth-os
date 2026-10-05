import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Account } from './entities/account.entity';
import { AccountAssessment } from './entities/account-assessment.entity';
import { AccountAssessmentWorkflow } from './account.workflow';
import { IcpService } from '../icp/icp.service';
import { SytadelIdentityService } from '../identity/sytadel-identity.service';
import { SYTADEL_SCOPES } from '../identity/scopes';
import { AuditService } from '../audit/audit.service';
import { AccountFitTier, AuditAction } from '../../common/enums';
import { ReferenceIntegrityError } from '../../common/errors';
import { LlmProviderError } from '../llm/llm-provider.interface';
import { InvalidModelOutputError } from '../../common/util/json';

/** Raised when account input is invalid (empty name or notes). */
export class InvalidAccountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidAccountError';
  }
}

/** Per-account result of a scoring run (resilient: one failure is recorded). */
export type AccountScoreOutcome = {
  accountId: string;
  name: string;
  ok: boolean;
  assessment?: AccountAssessment;
  error?: string;
};

/** Raised when scoring is attempted before any ICP exists. */
export class NoIcpError extends Error {
  constructor() {
    super('No ICP for this workspace; run `icp:generate` first.');
    this.name = 'NoIcpError';
  }
}

/** Raised when there are no accounts to score. */
export class NoAccountsError extends Error {
  constructor() {
    super('No accounts to score; add one with `account:add` first.');
    this.name = 'NoAccountsError';
  }
}

export type AddAccountInput = {
  workspaceId: string;
  name: string;
  notes: string;
  domain?: string | null;
};

@Injectable()
export class AccountService {
  constructor(
    @InjectRepository(Account)
    private readonly accounts: Repository<Account>,
    @InjectRepository(AccountAssessment)
    private readonly assessments: Repository<AccountAssessment>,
    private readonly workflow: AccountAssessmentWorkflow,
    private readonly icp: IcpService,
    private readonly identity: SytadelIdentityService,
    private readonly audit: AuditService,
  ) {}

  async add(input: AddAccountInput): Promise<Account> {
    if (input.name.trim() === '') {
      throw new InvalidAccountError('Account name is empty');
    }
    if (input.notes.trim() === '') {
      throw new InvalidAccountError(
        'Account notes are empty — provide --notes or --notes-file',
      );
    }
    const nameKey = normalizeName(input.name);
    const existing = await this.accounts.findOne({
      where: { workspaceId: input.workspaceId, nameKey },
    });
    if (existing) return existing;

    const entity = this.accounts.create({
      workspaceId: input.workspaceId,
      name: input.name.trim(),
      nameKey,
      domain: input.domain?.trim() || null,
      notes: input.notes,
    });
    try {
      return await this.accounts.save(entity);
    } catch (err) {
      if (err instanceof QueryFailedError) {
        const found = await this.accounts.findOne({
          where: { workspaceId: input.workspaceId, nameKey },
        });
        if (found) return found;
      }
      throw err;
    }
  }

  async list(workspaceId: string): Promise<Account[]> {
    return this.accounts.find({
      where: { workspaceId },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
  }

  async getById(workspaceId: string, id: string): Promise<Account> {
    const account = await this.accounts.findOne({ where: { id, workspaceId } });
    if (!account) throw new NotFoundException(`Account ${id} not found`);
    return account;
  }

  async latestAssessment(accountId: string): Promise<AccountAssessment | null> {
    return this.assessments.findOne({
      where: { accountId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Score accounts against the workspace's latest ICP. Read/analysis action →
   * requires `research:read` when Sytadel auth is on. RESILIENT per account: one
   * account failing (invalid ref, provider error, bad model output) is recorded
   * as a failed outcome and the batch continues — it never aborts the run.
   * Run-level preconditions (scope, ICP present, accounts present) still throw.
   */
  async score(
    workspaceId: string,
    executorId: string,
    accountId?: string,
  ): Promise<AccountScoreOutcome[]> {
    const principal = await this.identity.requireScope(
      SYTADEL_SCOPES.RESEARCH_READ,
    );

    const icp = await this.icp.getLatest(workspaceId);
    if (!icp) throw new NoIcpError();

    const targets = accountId
      ? [await this.getById(workspaceId, accountId)]
      : await this.list(workspaceId);
    if (targets.length === 0) throw new NoAccountsError();

    const segments = icp.content.segments;
    const icpForPrompt = {
      summary: icp.content.summary,
      segments: segments.map((s, i) => ({
        index: i + 1,
        name: s.name,
        description: s.description,
      })),
      idealCharacteristics: icp.content.idealCharacteristics,
      disqualifiers: icp.content.disqualifiers,
    };

    const outcomes: AccountScoreOutcome[] = [];
    for (const account of targets) {
      const base = { accountId: account.id, name: account.name };
      try {
        const { output } = await this.workflow.assess(icpForPrompt, {
          name: account.name,
          domain: account.domain,
          notes: account.notes,
        });

        const matchedSegments = output.matchedSegmentRefs.map((ref) => {
          const seg = segments[ref - 1];
          if (!seg) {
            throw new ReferenceIntegrityError(
              `Assessment cites segmentRef ${ref}, but the ICP has ${segments.length} segment(s)`,
            );
          }
          return seg.name;
        });

        const saved = await this.assessments.save(
          this.assessments.create({
            workspaceId,
            accountId: account.id,
            icpVersion: icp.version,
            fitScore: output.fitScore,
            tier: tierFromScore(output.fitScore),
            matchedSegments,
            rationale: output.rationale.trim(),
            gaps: output.gaps.map((g) => g.trim()),
            recommendedNextStep: output.recommendedNextStep.trim(),
          }),
        );

        await this.audit.record({
          workspaceId,
          action: AuditAction.ACCOUNT_SCORED,
          actor: {
            executorId,
            sytadelSubject: principal?.serviceAccountId ?? null,
            tenantId: principal?.tenantId ?? null,
          },
          metadata: {
            accountId: account.id,
            icpVersion: icp.version,
            fitScore: saved.fitScore,
            tier: saved.tier,
          },
        });

        outcomes.push({ ...base, ok: true, assessment: saved });
      } catch (err) {
        // Only EXPECTED per-account failures are isolated as a failed outcome so
        // the batch can continue. Unexpected errors (DB outage, programmer bugs)
        // must NOT be masked as one account's failure — rethrow so the run
        // aborts loudly instead of reporting a false partial success.
        if (!isExpectedAccountError(err)) throw err;
        outcomes.push({ ...base, ok: false, error: sanitizeAccountError(err) });
      }
    }
    return outcomes;
  }
}

/**
 * Per-account failures we expect and isolate (a bad model output or an invented
 * reference fails only that account). Anything else is systemic and must
 * propagate so a real outage is never hidden behind a per-account outcome.
 */
function isExpectedAccountError(err: unknown): boolean {
  return (
    err instanceof ReferenceIntegrityError ||
    err instanceof InvalidModelOutputError ||
    err instanceof LlmProviderError
  );
}

/** Safe per-account failure message (no payloads/secrets/source content). */
function sanitizeAccountError(err: unknown): string {
  if (isExpectedAccountError(err)) {
    return `${(err as Error).name}: ${(err as Error).message}`;
  }
  return 'Account scoring failed: unexpected error';
}

/** Derive the fit tier from the score (deterministic, not model-chosen). */
export function tierFromScore(score: number): AccountFitTier {
  if (score >= 0.7) return AccountFitTier.STRONG;
  if (score >= 0.4) return AccountFitTier.MEDIUM;
  return AccountFitTier.WEAK;
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
}
