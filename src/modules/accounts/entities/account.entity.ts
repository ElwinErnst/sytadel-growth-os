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
 * A candidate company/account the operator wants to evaluate against the ICP.
 * `notes` is operator-supplied profile text (what we know about the company) —
 * treated as untrusted data, like evidence. Automated discovery/enrichment via
 * fetch is a later increment (Slice 6b). Deduplicated per workspace by a
 * normalized name key.
 */
@Entity('accounts')
@Unique('uq_accounts_workspace_name', ['workspaceId', 'nameKey'])
export class Account {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('ix_accounts_workspace')
  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId!: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace!: Workspace;

  @Column({ name: 'name', type: 'text' })
  name!: string;

  /** Normalized (lowercased, collapsed) name for per-workspace dedup. */
  @Column({ name: 'name_key', type: 'text' })
  nameKey!: string;

  @Column({ name: 'domain', type: 'text', nullable: true })
  domain!: string | null;

  /** Operator-supplied profile/notes about the company (untrusted data). */
  @Column({ name: 'notes', type: 'text' })
  notes!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
