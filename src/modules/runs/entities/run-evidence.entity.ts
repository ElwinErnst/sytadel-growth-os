import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { AgentRun } from './agent-run.entity';
import { SourceEvidence } from '../../evidence/entities/source-evidence.entity';

/**
 * The evidence set supplied to a run. Signals produced by the run may ONLY
 * reference evidence linked here — this is what makes "the model cannot invent
 * references" enforceable at the data layer.
 */
@Entity('run_evidence')
@Unique('uq_run_evidence_pair', ['runId', 'evidenceId'])
export class RunEvidence {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'run_id', type: 'uuid' })
  runId!: string;

  @ManyToOne(() => AgentRun, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'run_id' })
  run!: AgentRun;

  @Column({ name: 'evidence_id', type: 'uuid' })
  evidenceId!: string;

  @ManyToOne(() => SourceEvidence, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'evidence_id' })
  evidence!: SourceEvidence;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
