import { Injectable } from '@nestjs/common';
import { SourceKind } from '../../../common/enums';
import { htmlToText } from '../../../common/util/html';
import { HttpFetcher } from '../../fetch/http-fetcher';
import { ResearchSource } from '../entities/research-source.entity';
import { CollectedItem, Connector, ConnectorError } from './connector';

/**
 * Generic web-page connector: fetches the URL under SSRF controls and, when the
 * response looks like HTML, normalizes it to readable text. Non-HTML responses
 * (plain text, JSON, …) are kept as-is. Covers changelogs, pricing pages, job
 * posts, blog posts, funding news, and most public pages.
 */
@Injectable()
export class WebPageConnector implements Connector {
  readonly kind = SourceKind.WEB_PAGE;

  constructor(private readonly fetcher: HttpFetcher) {}

  async collect(source: ResearchSource): Promise<CollectedItem[]> {
    const res = await this.fetcher.fetch(source.url);
    if (res.status < 200 || res.status >= 300) {
      throw new ConnectorError(`Non-success HTTP status ${res.status}`);
    }
    const isHtml = res.contentType.toLowerCase().includes('html');
    const content = (isHtml ? htmlToText(res.body) : res.body).trim();
    if (content.length === 0) {
      throw new ConnectorError('Collected content is empty after normalization');
    }
    return [
      {
        sourceName: source.label,
        sourceUrl: res.finalUrl,
        content,
        fetchedAt: res.fetchedAt,
      },
    ];
  }
}
