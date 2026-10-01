import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AuditAction } from '../../../common/enums';

/**
 * An append-only audit event for an agent action. Carries both identities when
 * present — the local executor and (when Sytadel auth is on) the authenticated
 * principal — so actions are traceable. Metadata is a small, sanitized object:
 * it never contains secrets, tokens, or raw source content.
 *
 * No FK/relations on purpose: audit must survive even if the referenced run is
 * later removed, and the trail is queried by id, not joined.
 */
@Entity('agent_audit_events')
export class AgentAuditEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('ix_audit_workspace')
  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId!: string;

  @Index('ix_audit_run')
  @Column({ name: 'run_id', type: 'uuid', nullable: true })
  runId!: string | null;

  /** Local operator identity (if any). */
  @Column({ name: 'actor_executor_id', type: 'text', nullable: true })
  actorExecutorId!: string | null;

  /** Sytadel-authenticated principal (serviceAccountId), when auth is on. */
  @Column({ name: 'actor_sytadel_subject', type: 'text', nullable: true })
  actorSytadelSubject!: string | null;

  @Column({ name: 'actor_tenant_id', type: 'uuid', nullable: true })
  actorTenantId!: string | null;

  @Column({ name: 'action', type: 'text' })
  action!: AuditAction;

  /** Small, sanitized key/values. No secrets, tokens, or source content. */
  @Column({ name: 'metadata', type: 'jsonb', default: {} })
  metadata!: Record<string, string | number | boolean | null>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
