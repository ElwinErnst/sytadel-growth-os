import { Injectable } from '@nestjs/common';
import { HttpFetcher, FetchError } from './http-fetcher';
import { EvidenceService } from '../evidence/evidence.service';
import { SourceEvidence } from '../evidence/entities/source-evidence.entity';
import { EvidenceProvenance } from '../../common/enums';
import { SytadelIdentityService } from '../identity/sytadel-identity.service';
import { SYTADEL_SCOPES } from '../identity/scopes';

/**
 * Fetches a URL under SSRF controls and stores the result as FETCHED evidence.
 * Only successful (2xx) responses become evidence; anything else fails loudly.
 * The stored content is untrusted data, exactly like manual evidence.
 */
@Injectable()
export class FetchService {
  constructor(
    private readonly fetcher: HttpFetcher,
    private readonly evidence: EvidenceService,
    private readonly identity: SytadelIdentityService,
  ) {}

  async fetchToEvidence(
    workspaceId: string,
    url: string,
    sourceName?: string,
  ): Promise<SourceEvidence> {
    // Outbound fetch requires the research:fetch scope when Sytadel auth is on
    // (no-op under the local identity).
    await this.identity.requireScope(SYTADEL_SCOPES.RESEARCH_FETCH);

    const result = await this.fetcher.fetch(url);
    if (result.status < 200 || result.status >= 300) {
      throw new FetchError(`Non-success HTTP status ${result.status}`);
    }
    if (result.body.trim().length === 0) {
      throw new FetchError('Fetched response body is empty');
    }
    const name =
      sourceName?.trim() || `Fetched: ${new URL(result.finalUrl).host}`;
    return this.evidence.ingest({
      workspaceId,
      sourceName: name,
      sourceUrl: result.finalUrl,
      retrievedAt: result.fetchedAt,
      content: result.body,
      provenance: EvidenceProvenance.FETCHED,
    });
  }
}
