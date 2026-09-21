import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { SourceEvidence } from './entities/source-evidence.entity';
import { EvidenceProvenance } from '../../common/enums';
import { PageParams } from '../../common/pagination';
import { sha256 } from '../../common/util/hash';

export type IngestEvidenceInput = {
  workspaceId: string;
  sourceName: string;
  /** DECLARED origin URL. We do NOT fetch or verify it in this slice. */
  sourceUrl: string;
  retrievedAt: Date;
  content: string;
};

/**
 * Persists operator-supplied evidence. Content is stored verbatim and treated
 * downstream as untrusted data. Deduplicated per workspace by content hash so
 * re-ingesting the same material returns the existing row (idempotent) instead
 * of creating duplicates.
 */
@Injectable()
export class EvidenceService {
  constructor(
    @InjectRepository(SourceEvidence)
    private readonly repo: Repository<SourceEvidence>,
  ) {}

  async ingest(input: IngestEvidenceInput): Promise<SourceEvidence> {
    const content = input.content;
    if (content.trim().length === 0) {
      throw new BadRequestException('Evidence content is empty');
    }
    if (!isHttpUrl(input.sourceUrl)) {
      throw new BadRequestException(
        'sourceUrl must be an http(s) URL (declared origin, not fetched)',
      );
    }
    if (Number.isNaN(input.retrievedAt.getTime())) {
      throw new BadRequestException('retrievedAt is not a valid date');
    }

    const contentHash = sha256(content);
    const existing = await this.repo.findOne({
      where: { workspaceId: input.workspaceId, contentHash },
    });
    if (existing) return existing;

    const entity = this.repo.create({
      workspaceId: input.workspaceId,
      sourceName: input.sourceName.trim(),
      sourceUrl: input.sourceUrl.trim(),
      retrievedAt: input.retrievedAt,
      provenance: EvidenceProvenance.MANUAL,
      contentHash,
      content,
      contentBytes: Buffer.byteLength(content, 'utf8'),
    });

    try {
      return await this.repo.save(entity);
    } catch (err) {
      // Concurrent identical ingest: unique (workspace, hash) fired. Re-read.
      if (err instanceof QueryFailedError) {
        const found = await this.repo.findOne({
          where: { workspaceId: input.workspaceId, contentHash },
        });
        if (found) return found;
      }
      throw err;
    }
  }

  async findByIdInWorkspace(
    workspaceId: string,
    id: string,
  ): Promise<SourceEvidence | null> {
    return this.repo.findOne({ where: { id, workspaceId } });
  }

  async listByWorkspace(
    workspaceId: string,
    page: PageParams,
  ): Promise<SourceEvidence[]> {
    return this.repo.find({
      where: { workspaceId },
      order: { ingestedAt: 'DESC', id: 'ASC' },
      take: page.limit,
      skip: page.offset,
    });
  }

  async countByWorkspace(workspaceId: string): Promise<number> {
    return this.repo.count({ where: { workspaceId } });
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
