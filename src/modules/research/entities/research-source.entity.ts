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
import { SourceKind } from '../../../common/enums';
import { Workspace } from '../../workspaces/entities/workspace.entity';

/**
 * A configured research source for a workspace. A `research` run collects every
 * enabled source through its connector and stores the result as `fetched`
 * evidence. Unique per (workspace, url) so the same source is registered once.
 */
@Entity('research_sources')
@Unique('uq_research_source_workspace_url', ['workspaceId', 'url'])
export class ResearchSource {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('ix_research_sources_workspace')
  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId!: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace!: Workspace;

  @Column({ name: 'kind', type: 'text', default: SourceKind.WEB_PAGE })
  kind!: SourceKind;

  /** The source URL. Validated + fetched under SSRF controls at collect time. */
  @Column({ name: 'url', type: 'text' })
  url!: string;

  /** Operator-facing label used as the evidence source name. */
  @Column({ name: 'label', type: 'text' })
  label!: string;

  @Column({ name: 'enabled', type: 'boolean', default: true })
  enabled!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
