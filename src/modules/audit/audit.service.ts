import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentAuditEvent } from './entities/agent-audit-event.entity';
import { AuditAction } from '../../common/enums';
import { PageParams } from '../../common/pagination';

export type AuditActor = {
  executorId?: string | null;
  sytadelSubject?: string | null;
  tenantId?: string | null;
};

export type RecordAuditInput = {
  workspaceId: string;
  runId?: string | null;
  action: AuditAction;
  actor?: AuditActor;
  metadata?: Record<string, string | number | boolean | null>;
};

/**
 * Append-only agent-action audit. `record` is FAILURE-ISOLATED: an audit write
 * must never break the operation it describes, so persistence errors are caught
 * and logged, not thrown. Read methods are plain, workspace/run-scoped queries.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AgentAuditEvent)
    private readonly repo: Repository<AgentAuditEvent>,
  ) {}

  async record(input: RecordAuditInput): Promise<void> {
    try {
      await this.repo.insert({
        workspaceId: input.workspaceId,
        runId: input.runId ?? null,
        actorExecutorId: input.actor?.executorId ?? null,
        actorSytadelSubject: input.actor?.sytadelSubject ?? null,
        actorTenantId: input.actor?.tenantId ?? null,
        action: input.action,
        metadata: input.metadata ?? {},
      });
    } catch (err) {
      // Never let auditing break the audited operation.
      const name = err instanceof Error ? err.name : 'unknown';
      this.logger.warn(
        `Failed to record audit event ${input.action} (${name})`,
      );
    }
  }

  async listByRun(runId: string): Promise<AgentAuditEvent[]> {
    return this.repo.find({
      where: { runId },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
  }

  async listByWorkspace(
    workspaceId: string,
    page: PageParams,
  ): Promise<AgentAuditEvent[]> {
    return this.repo.find({
      where: { workspaceId },
      order: { createdAt: 'DESC', id: 'ASC' },
      take: page.limit,
      skip: page.offset,
    });
  }

  async countByWorkspace(workspaceId: string): Promise<number> {
    return this.repo.count({ where: { workspaceId } });
  }
}
