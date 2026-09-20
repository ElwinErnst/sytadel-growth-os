import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import {
  AgentRole,
  ExecutorKind,
  RunStage,
  RunStatus,
} from '../../../common/enums';
import { Workspace } from '../../workspaces/entities/workspace.entity';

/**
 * One execution of the market-research workflow over a set of evidence.
 *
 * Idempotency: `(workspaceId, idempotencyKey)` is unique. Re-invoking with the
 * same key RETRIES the same logical run (same workflow/prompt version) rather
 * than creating a new one. To REPROCESS deliberately, the operator supplies a
 * new idempotency key and typically a bumped workflow/prompt version — that is
 * a new run producing its own signals and brief.
 */
@Entity('agent_runs')
@Unique('uq_runs_workspace_idempotency', ['workspaceId', 'idempotencyKey'])
export class AgentRun {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('ix_runs_workspace')
  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId!: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace!: Workspace;

  /** Client-supplied dedup key, unique per workspace. */
  @Column({ name: 'idempotency_key', type: 'text' })
  idempotencyKey!: string;

  // --- Executor identity (LOCAL only in this slice) ------------------------
  /**
   * Local operator identifier. This is an identity internal to Growth OS and
   * is intentionally NOT a Sytadel-authenticated subject. When Sytadel identity
   * integration lands, a separate nullable `sytadel_subject` column will hold
   * the authenticated principal; the two must never be conflated.
   */
  @Column({ name: 'executor_id', type: 'text' })
  executorId!: string;

  @Column({
    name: 'executor_kind',
    type: 'text',
    default: ExecutorKind.LOCAL,
  })
  executorKind!: ExecutorKind;

  // --- Workflow provenance -------------------------------------------------
  @Column({ name: 'agent_role', type: 'text', default: AgentRole.MARKET_RESEARCH })
  agentRole!: AgentRole;

  @Column({ name: 'workflow_version', type: 'text' })
  workflowVersion!: string;

  @Column({ name: 'prompt_version', type: 'text' })
  promptVersion!: string;

  @Column({ name: 'provider', type: 'text' })
  provider!: string;

  @Column({ name: 'model', type: 'text' })
  model!: string;

  // --- State machine -------------------------------------------------------
  @Index('ix_runs_status')
  @Column({ name: 'status', type: 'text', default: RunStatus.PENDING })
  status!: RunStatus;

  @Column({ name: 'stage', type: 'text', default: RunStage.CREATED })
  stage!: RunStage;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt!: Date | null;

  // --- Consumption ---------------------------------------------------------
  @Column({ name: 'input_tokens', type: 'int', default: 0 })
  inputTokens!: number;

  @Column({ name: 'output_tokens', type: 'int', default: 0 })
  outputTokens!: number;

  /**
   * Sanitized failure reason. Never contains raw source content, secrets, or
   * unbounded provider payloads — only a stable, safe-to-log message.
   */
  @Column({ name: 'error', type: 'text', nullable: true })
  error!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
