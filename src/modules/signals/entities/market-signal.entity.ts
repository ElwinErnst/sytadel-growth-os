import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { SignalCategory, SignalKind } from '../../../common/enums';
import { Workspace } from '../../workspaces/entities/workspace.entity';
import { AgentRun } from '../../runs/entities/agent-run.entity';
import { SourceEvidence } from '../../evidence/entities/source-evidence.entity';

/**
 * A structured claim extracted by the analysis workflow. Every signal MUST
 * reference a piece of evidence that was supplied to the same run and belongs
 * to the same workspace. The service layer rejects signals whose `evidenceId`
 * is not in the run's evidence set, so the model cannot invent references.
 *
 * Deduplicated within a run by `fingerprint` (a hash of the normalized claim),
 * enforced by a unique constraint so concurrent inserts cannot duplicate.
 */
@Entity('market_signals')
@Unique('uq_signal_run_fingerprint', ['runId', 'fingerprint'])
export class MarketSignal {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('ix_signals_workspace')
  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId!: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace!: Workspace;

  @Index('ix_signals_run')
  @Column({ name: 'run_id', type: 'uuid' })
  runId!: string;

  @ManyToOne(() => AgentRun, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'run_id' })
  run!: AgentRun;

  @Column({ name: 'evidence_id', type: 'uuid' })
  evidenceId!: string;

  @ManyToOne(() => SourceEvidence, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'evidence_id' })
  evidence!: SourceEvidence;

  @Column({ name: 'category', type: 'text' })
  category!: SignalCategory;

  /** FACT (stated by evidence) vs HYPOTHESIS (inferred by the model). */
  @Column({ name: 'kind', type: 'text' })
  kind!: SignalKind;

  @Column({ name: 'statement', type: 'text' })
  statement!: string;

  /** Short verbatim-ish snippet from the evidence backing the statement. */
  @Column({ name: 'evidence_quote', type: 'text', nullable: true })
  evidenceQuote!: string | null;

  /** Model-reported confidence in [0,1]. */
  @Column({ name: 'confidence', type: 'real' })
  confidence!: number;

  /** Hash of the normalized statement; drives per-run dedup. */
  @Column({ name: 'fingerprint', type: 'text' })
  fingerprint!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
