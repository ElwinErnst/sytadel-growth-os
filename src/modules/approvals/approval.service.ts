import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApprovalRequest } from './entities/approval-request.entity';
import {
  ApprovalAction,
  ApprovalStatus,
  AuditAction,
} from '../../common/enums';
import { PageParams } from '../../common/pagination';
import { AuditService } from '../audit/audit.service';

/** Raised when an action is attempted without an APPROVED approval. */
export class ApprovalRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApprovalRequiredError';
  }
}

/** Raised for an invalid approval state transition (e.g. deciding twice). */
export class ApprovalStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApprovalStateError';
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ProposeApprovalInput = {
  workspaceId: string;
  action: ApprovalAction;
  params: Record<string, string | number | boolean | null>;
  requestedBy: string;
  expiresAt?: Date | null;
};

/**
 * The human-in-the-loop gate. Proposing an action persists a PENDING request and
 * does NOT execute anything. Execution must call `requireApproved`, which only
 * succeeds for an APPROVED, un-executed, non-expired request of the expected
 * action — then `markExecuted` pins it so it cannot be replayed. This invariant
 * outranks any scope grant: nothing with an external side effect runs without an
 * explicit human approval.
 */
@Injectable()
export class ApprovalService {
  constructor(
    @InjectRepository(ApprovalRequest)
    private readonly repo: Repository<ApprovalRequest>,
    private readonly audit: AuditService,
  ) {}

  async propose(input: ProposeApprovalInput): Promise<ApprovalRequest> {
    const request = await this.repo.save(
      this.repo.create({
        workspaceId: input.workspaceId,
        action: input.action,
        params: input.params,
        status: ApprovalStatus.PENDING,
        requestedBy: input.requestedBy,
        expiresAt: input.expiresAt ?? null,
      }),
    );
    await this.emit(request, AuditAction.APPROVAL_REQUESTED, input.requestedBy);
    return request;
  }

  async approve(id: string, decidedBy: string): Promise<ApprovalRequest> {
    return this.decide(id, ApprovalStatus.APPROVED, decidedBy);
  }

  async deny(id: string, decidedBy: string): Promise<ApprovalRequest> {
    return this.decide(id, ApprovalStatus.DENIED, decidedBy);
  }

  async get(id: string): Promise<ApprovalRequest> {
    const request = await this.repo.findOne({ where: { id } });
    if (!request) throw new NotFoundException(`Approval ${id} not found`);
    return this.applyExpiry(request);
  }

  async listByWorkspace(
    workspaceId: string,
    page: PageParams,
    status?: ApprovalStatus,
  ): Promise<ApprovalRequest[]> {
    const rows = await this.repo.find({
      where: status ? { workspaceId, status } : { workspaceId },
      order: { createdAt: 'DESC', id: 'ASC' },
      take: page.limit,
      skip: page.offset,
    });
    return Promise.all(rows.map((r) => this.applyExpiry(r)));
  }

  /**
   * The execution gate. Returns the request only if it is APPROVED, matches the
   * expected action, and has not already executed — otherwise throws.
   */
  async requireApproved(
    id: string,
    expectedAction: ApprovalAction,
  ): Promise<ApprovalRequest> {
    const request = await this.get(id);
    if (request.action !== expectedAction) {
      throw new ApprovalStateError(
        `Approval ${id} is for "${request.action}", not "${expectedAction}"`,
      );
    }
    if (request.status !== ApprovalStatus.APPROVED) {
      throw new ApprovalRequiredError(
        `Approval ${id} is "${request.status}", not approved`,
      );
    }
    if (request.executedAt !== null) {
      throw new ApprovalStateError(`Approval ${id} was already executed`);
    }
    return request;
  }

  /** Pin an approved request as executed so it cannot be replayed. */
  async markExecuted(id: string): Promise<void> {
    await this.repo.update({ id }, { executedAt: new Date() });
  }

  // --- internals -----------------------------------------------------------

  private async decide(
    id: string,
    status: ApprovalStatus.APPROVED | ApprovalStatus.DENIED,
    decidedBy: string,
  ): Promise<ApprovalRequest> {
    const request = await this.get(id);
    if (request.status !== ApprovalStatus.PENDING) {
      throw new ApprovalStateError(
        `Approval ${id} is "${request.status}" and cannot be decided`,
      );
    }
    request.status = status;
    request.decidedBy = decidedBy;
    request.decidedAt = new Date();
    const saved = await this.repo.save(request);
    await this.emit(
      saved,
      status === ApprovalStatus.APPROVED
        ? AuditAction.APPROVAL_APPROVED
        : AuditAction.APPROVAL_DENIED,
      decidedBy,
    );
    return saved;
  }

  /** Lazily flip a stale PENDING request to EXPIRED. */
  private async applyExpiry(request: ApprovalRequest): Promise<ApprovalRequest> {
    if (
      request.status === ApprovalStatus.PENDING &&
      request.expiresAt !== null &&
      request.expiresAt.getTime() < Date.now()
    ) {
      request.status = ApprovalStatus.EXPIRED;
      return this.repo.save(request);
    }
    return request;
  }

  private async emit(
    request: ApprovalRequest,
    action: AuditAction,
    actor: string,
  ): Promise<void> {
    // params are free-form; only link a runId that is actually a UUID (the audit
    // run_id column is typed uuid). Otherwise leave it unlinked.
    const candidate = request.params.runId;
    const runId =
      typeof candidate === 'string' && UUID_RE.test(candidate)
        ? candidate
        : null;
    await this.audit.record({
      workspaceId: request.workspaceId,
      runId,
      action,
      actor: { executorId: actor },
      metadata: { approvalId: request.id, approvalAction: request.action },
    });
  }
}
