import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApprovalAction, ApprovalStatus } from '../../../common/enums';

/**
 * A human-in-the-loop approval for an action with an external side effect. The
 * action is proposed PENDING and must be APPROVED by a human before it may
 * execute; DENIED/EXPIRED are terminal. `executedAt` is set once on execution
 * so an approval cannot be replayed.
 *
 * `params` is a small, sanitized description of the action (e.g. which brief,
 * which destination) — never secrets or source content.
 */
@Entity('approval_requests')
export class ApprovalRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('ix_approvals_workspace')
  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId!: string;

  @Index('ix_approvals_status')
  @Column({ name: 'status', type: 'text', default: ApprovalStatus.PENDING })
  status!: ApprovalStatus;

  @Column({ name: 'action', type: 'text' })
  action!: ApprovalAction;

  @Column({ name: 'params', type: 'jsonb', default: {} })
  params!: Record<string, string | number | boolean | null>;

  @Column({ name: 'requested_by', type: 'text' })
  requestedBy!: string;

  @Column({ name: 'decided_by', type: 'text', nullable: true })
  decidedBy!: string | null;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt!: Date | null;

  @Column({ name: 'executed_at', type: 'timestamptz', nullable: true })
  executedAt!: Date | null;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
