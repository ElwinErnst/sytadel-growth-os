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
import { Workspace } from '../../workspaces/entities/workspace.entity';

/**
 * Structured Ideal-Customer-Profile content. Grounded items cite the signal ids
 * they rest on, so every ICP claim traces back to persisted evidence-backed
 * signals. Facts/hypotheses separation is inherited from the signals cited.
 */
export type IcpContent = {
  summary: string;
  /** Candidate target segments, each grounded in signals. */
  segments: Array<{ name: string; description: string; signalIds: string[] }>;
  /** Firmographic / behavioral traits of a good-fit account. */
  idealCharacteristics: string[];
  /** Pains the ICP feels, grounded in signals. */
  keyPains: Array<{ pain: string; signalIds: string[] }>;
  /** Traits that disqualify an account. */
  disqualifiers: string[];
  /** The single first segment to target. */
  recommendedBeachhead: string;
  /** Hypotheses worth validating before committing. */
  hypothesesToValidate: string[];
  /** What is uncertain / not covered given the signals. */
  uncertainty: string[];
};

/**
 * A versioned ICP for a workspace, synthesized from its market signals. One row
 * per (workspace, version); the latest version is the current ICP.
 */
@Entity('icp_profiles')
@Unique('uq_icp_workspace_version', ['workspaceId', 'version'])
export class IcpProfile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('ix_icp_workspace')
  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId!: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace!: Workspace;

  @Column({ name: 'version', type: 'int' })
  version!: number;

  @Column({ name: 'title', type: 'text' })
  title!: string;

  @Column({ name: 'content', type: 'jsonb' })
  content!: IcpContent;

  @Column({ name: 'body_markdown', type: 'text' })
  bodyMarkdown!: string;

  /** How many signals the synthesis was given. */
  @Column({ name: 'source_signal_count', type: 'int' })
  sourceSignalCount!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
