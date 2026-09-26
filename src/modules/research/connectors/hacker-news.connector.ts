import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { SourceKind } from '../../../common/enums';
import { HttpFetcher } from '../../fetch/http-fetcher';
import { ResearchSource } from '../entities/research-source.entity';
import { CollectedItem, Connector, ConnectorError } from './connector';
import { fetchJson, snippet } from './json-source';

/** Shape of the Hacker News Algolia search response we rely on. */
const hnSchema = z.object({
  hits: z.array(
    z.object({
      title: z.string().nullable().optional(),
      url: z.string().nullable().optional(),
      author: z.string().nullable().optional(),
      points: z.number().nullable().optional(),
      num_comments: z.number().nullable().optional(),
      created_at: z.string().nullable().optional(),
      objectID: z.string(),
      story_text: z.string().nullable().optional(),
    }),
  ),
});

const MAX_HITS = 15;

/**
 * Collects a Hacker News search via the public Algolia API. The source `url` is
 * the full Algolia search URL (e.g.
 * `https://hn.algolia.com/api/v1/search?query=agent%20identity&tags=story`).
 * Produces one text digest of the top stories as `fetched` evidence.
 */
@Injectable()
export class HackerNewsConnector implements Connector {
  readonly kind = SourceKind.HACKER_NEWS;

  constructor(private readonly fetcher: HttpFetcher) {}

  async collect(source: ResearchSource): Promise<CollectedItem[]> {
    const data = await fetchJson(this.fetcher, source.url, hnSchema);
    const hits = data.hits.slice(0, MAX_HITS);
    if (hits.length === 0) {
      throw new ConnectorError('Hacker News search returned no stories');
    }

    const lines = hits.map((h, i) => {
      const title = h.title?.trim() || '(untitled)';
      const points = h.points ?? 0;
      const comments = h.num_comments ?? 0;
      const link = h.url?.trim() || `https://news.ycombinator.com/item?id=${h.objectID}`;
      const when = h.created_at?.slice(0, 10) ?? '';
      const parts = [
        `${i + 1}. ${title} — ${points} pts, ${comments} comments — ${link}${when ? ` (${when})` : ''}`,
      ];
      if (h.story_text) parts.push(`   ${snippet(h.story_text)}`);
      return parts.join('\n');
    });

    const content = [`Hacker News stories (top ${hits.length}):`, '', ...lines].join('\n');
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
