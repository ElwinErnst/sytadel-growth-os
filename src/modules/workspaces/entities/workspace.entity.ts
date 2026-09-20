import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * A workspace is the isolation boundary for all Growth OS data. Every piece of
 * evidence, every run, signal, and brief belongs to exactly one workspace, and
 * cross-workspace references are rejected. The operator configures which
 * workspace a CLI invocation targets.
 */
@Entity('workspaces')
export class Workspace {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Stable human-facing handle used on the CLI (e.g. `sytadel`). */
  @Index('uq_workspaces_slug', { unique: true })
  @Column({ type: 'text' })
  slug!: string;

  @Column({ type: 'text' })
  name!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
