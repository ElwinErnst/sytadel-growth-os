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
import { AgentRun } from '../../runs/entities/agent-run.entity';

/**
 * Structured payload of a Founder Brief. Deliberately separates epistemic
 * categories so the reader never confuses a fact with a recommendation.
 */
export type FounderBriefContent = {
  /** Findings grounded in signals, each citing the signals it rests on. */
  findings: Array<{
    statement: string;
    /** Signal ids this finding rests on. */
    signalIds: string[];
  }>;
  /** What this could mean for Sytadel specifically. */
  implicationsForSytadel: string[];
  /** Hypotheses worth validating (explicitly not asserted as fact). */
  hypothesesToValidate: string[];
  /** The single next experiment suggested. */
  nextExperiment: string;
  /** Uncertainty and the limits of what this brief covers. */
  uncertaintyAndCoverage: string[];
};

/**
 * A Founder Brief generated from the signals persisted by a run. Exactly one
 * per run (unique `runId`), built ONLY from persisted signals — the writer
 * step receives no new evidence, so every claim traces back to a signal.
 */
@Entity('founder_briefs')
@Unique('uq_brief_run', ['runId'])
export class FounderBrief {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('ix_briefs_workspace')
  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId!: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace!: Workspace;

  @Column({ name: 'run_id', type: 'uuid' })
  runId!: string;

  @ManyToOne(() => AgentRun, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'run_id' })
  run!: AgentRun;

  @Column({ name: 'title', type: 'text' })
  title!: string;

  /** Rendered Markdown, safe to export to disk or paste into a doc. */
  @Column({ name: 'body_markdown', type: 'text' })
  bodyMarkdown!: string;

  /** The structured source of the rendered brief. */
  @Column({ name: 'content', type: 'jsonb' })
  content!: FounderBriefContent;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
