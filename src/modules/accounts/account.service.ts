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
      throw new ReferenceIntegrityError('Account name is empty');
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
   * requires `research:read` when Sytadel auth is on.
   */
  async score(
    workspaceId: string,
    executorId: string,
    accountId?: string,
  ): Promise<AccountAssessment[]> {
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

    const results: AccountAssessment[] = [];
    for (const account of targets) {
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
      results.push(saved);

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
    }
    return results;
  }
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
