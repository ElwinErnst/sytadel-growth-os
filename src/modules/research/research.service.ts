import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryFailedError, Repository } from 'typeorm';
import { ResearchSource } from './entities/research-source.entity';
import { EvidenceProvenance, SourceKind } from '../../common/enums';
import { EvidenceService } from '../evidence/evidence.service';
import { SsrfBlockedError, validateFetchUrl } from '../fetch/ssrf';
import { FetchError } from '../fetch/http-fetcher';
import { Connector, ConnectorError } from './connectors/connector';
import { WebPageConnector } from './connectors/web-page.connector';
import { HackerNewsConnector } from './connectors/hacker-news.connector';
import { GitHubReleasesConnector } from './connectors/github-releases.connector';

/** Per-source result of a research run. */
export type SourceOutcome = {
  sourceId: string;
  url: string;
  label: string;
  ok: boolean;
  evidenceIds: string[];
  error?: string;
};

export type ResearchRunResult = {
  outcomes: SourceOutcome[];
  stored: number;
  failed: number;
};

/**
 * Owns the per-workspace research source registry and executes research runs.
 * A run collects every enabled source through its connector and stores results
 * as `fetched` evidence. It is RESILIENT: one source failing (blocked, timeout,
 * empty) is recorded and the batch continues — a bad source never aborts the run
 * or fabricates content.
 */
@Injectable()
export class ResearchService {
  private readonly connectors: Map<SourceKind, Connector>;

  constructor(
    @InjectRepository(ResearchSource)
    private readonly sources: Repository<ResearchSource>,
    private readonly evidence: EvidenceService,
    webPage: WebPageConnector,
    hackerNews: HackerNewsConnector,
    githubReleases: GitHubReleasesConnector,
  ) {
    this.connectors = new Map<SourceKind, Connector>([
      [webPage.kind, webPage],
      [hackerNews.kind, hackerNews],
      [githubReleases.kind, githubReleases],
    ]);
  }

  // --- registry ------------------------------------------------------------

  async addSource(
    workspaceId: string,
    url: string,
    label?: string,
    kind: SourceKind = SourceKind.WEB_PAGE,
  ): Promise<ResearchSource> {
    // Reject blocked/invalid URLs at registration for fast feedback.
    const parsed = validateFetchUrl(url);
    const normalizedUrl = parsed.href;

    const existing = await this.sources.findOne({
      where: { workspaceId, url: normalizedUrl },
    });
    if (existing) return existing;

    const entity = this.sources.create({
      workspaceId,
      url: normalizedUrl,
      label: label?.trim() || parsed.host,
      kind,
      enabled: true,
    });
    try {
      return await this.sources.save(entity);
    } catch (err) {
      if (err instanceof QueryFailedError) {
        const found = await this.sources.findOne({
          where: { workspaceId, url: normalizedUrl },
        });
        if (found) return found;
      }
      throw err;
    }
  }

  async listSources(workspaceId: string): Promise<ResearchSource[]> {
    return this.sources.find({
      where: { workspaceId },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
  }

  // --- run -----------------------------------------------------------------

  async run(
    workspaceId: string,
    sourceIds?: string[],
  ): Promise<ResearchRunResult> {
    const where =
      sourceIds && sourceIds.length > 0
        ? { workspaceId, enabled: true, id: In(sourceIds) }
        : { workspaceId, enabled: true };
    const sources = await this.sources.find({
      where,
      order: { createdAt: 'ASC', id: 'ASC' },
    });

    const outcomes: SourceOutcome[] = [];
    for (const source of sources) {
      outcomes.push(await this.collectOne(workspaceId, source));
    }
    return {
      outcomes,
      stored: outcomes.filter((o) => o.ok).length,
      failed: outcomes.filter((o) => !o.ok).length,
    };
  }

  private async collectOne(
    workspaceId: string,
    source: ResearchSource,
  ): Promise<SourceOutcome> {
    const base = { sourceId: source.id, url: source.url, label: source.label };
    const connector = this.connectors.get(source.kind);
    if (!connector) {
      return { ...base, ok: false, evidenceIds: [], error: `No connector for kind ${source.kind}` };
    }
    try {
      const items = await connector.collect(source);
      const evidenceIds: string[] = [];
      for (const item of items) {
        const ev = await this.evidence.ingest({
          workspaceId,
          sourceName: item.sourceName,
          sourceUrl: item.sourceUrl,
          retrievedAt: item.fetchedAt,
          content: item.content,
          provenance: EvidenceProvenance.FETCHED,
        });
        evidenceIds.push(ev.id);
      }
      return { ...base, ok: true, evidenceIds };
    } catch (err) {
      return { ...base, ok: false, evidenceIds: [], error: sanitize(err) };
    }
  }
}

/** Safe, stable per-source error string (no payloads/secrets). */
function sanitize(err: unknown): string {
  if (
    err instanceof SsrfBlockedError ||
    err instanceof FetchError ||
    err instanceof ConnectorError
  ) {
    return `${err.name}: ${err.message}`;
  }
  return 'Source collection failed: unexpected error';
}
