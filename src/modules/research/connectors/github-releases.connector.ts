import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { SourceKind } from '../../../common/enums';
import { HttpFetcher } from '../../fetch/http-fetcher';
import { ResearchSource } from '../entities/research-source.entity';
import { CollectedItem, Connector, ConnectorError } from './connector';
import { fetchJson, snippet } from './json-source';

/** Shape of the GitHub releases REST response we rely on. */
const releasesSchema = z.array(
  z.object({
    tag_name: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
    published_at: z.string().nullable().optional(),
    draft: z.boolean().nullable().optional(),
    prerelease: z.boolean().nullable().optional(),
    body: z.string().nullable().optional(),
    html_url: z.string().nullable().optional(),
  }),
);

const MAX_RELEASES = 10;

/**
 * Collects a GitHub repository's releases via the public REST API (no auth;
 * IP-rate-limited). The source `url` is the releases endpoint, e.g.
 * `https://api.github.com/repos/<owner>/<repo>/releases`. Produces one text
 * digest of recent releases as `fetched` evidence.
 */
@Injectable()
export class GitHubReleasesConnector implements Connector {
  readonly kind = SourceKind.GITHUB_RELEASES;

  constructor(private readonly fetcher: HttpFetcher) {}

  async collect(source: ResearchSource): Promise<CollectedItem[]> {
    const releases = await fetchJson(this.fetcher, source.url, releasesSchema);
    const visible = releases
      .filter((r) => !r.draft)
      .slice(0, MAX_RELEASES);
    if (visible.length === 0) {
      throw new ConnectorError('No published releases found');
    }

    const lines = visible.map((r) => {
      const tag = r.tag_name?.trim() || '(no tag)';
      const name = r.name?.trim() || '';
      const when = r.published_at?.slice(0, 10) ?? '';
      const flag = r.prerelease ? ' [prerelease]' : '';
      const head = `- ${tag}${name ? ` "${name}"` : ''}${when ? ` (${when})` : ''}${flag}`;
      return r.body ? `${head}\n  ${snippet(r.body)}` : head;
    });

    const content = [`GitHub releases (${visible.length}):`, '', ...lines].join('\n');
    return [
      {
        sourceName: source.label,
        sourceUrl: source.url,
        content,
        fetchedAt: new Date(),
      },
    ];
  }
}
