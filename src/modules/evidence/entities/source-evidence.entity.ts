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
import { EvidenceProvenance } from '../../../common/enums';
import { Workspace } from '../../workspaces/entities/workspace.entity';

/**
 * A single, operator-supplied piece of source material. The content is treated
 * as UNTRUSTED input: any instructions inside it are data, never commands.
 *
 * `sourceUrl` and `retrievedAt` are DECLARED by the operator. Growth OS did not
 * visit or verify the URL in this slice — see docs/integration for the future
 * fetch phase (with SSRF controls).
 *
 * Deduplicated per workspace by `contentHash`: re-ingesting identical content
 * returns the existing row instead of creating a duplicate.
 */
@Entity('source_evidence')
@Unique('uq_evidence_workspace_hash', ['workspaceId', 'contentHash'])
export class SourceEvidence {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('ix_evidence_workspace')
  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId!: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace!: Workspace;

  /** Operator-declared source name, e.g. "Competitor X pricing page". */
  @Column({ name: 'source_name', type: 'text' })
  sourceName!: string;

  /** Operator-declared origin URL. NOT fetched or verified by Growth OS. */
  @Column({ name: 'source_url', type: 'text' })
  sourceUrl!: string;

  /** Operator-declared retrieval timestamp. */
  @Column({ name: 'retrieved_at', type: 'timestamptz' })
  retrievedAt!: Date;

  @Column({
    name: 'provenance',
    type: 'text',
    default: EvidenceProvenance.MANUAL,
  })
  provenance!: EvidenceProvenance;

  /** SHA-256 of the raw content. Drives per-workspace deduplication. */
  @Column({ name: 'content_hash', type: 'text' })
  contentHash!: string;

  @Column({ name: 'content', type: 'text' })
  content!: string;

  @Column({ name: 'content_bytes', type: 'int' })
  contentBytes!: number;

  @CreateDateColumn({ name: 'ingested_at', type: 'timestamptz' })
  ingestedAt!: Date;
}
