import { SourceKind } from '../../../common/enums';
import { ResearchSource } from '../entities/research-source.entity';

/** One normalized item collected from a source, ready to become evidence. */
export type CollectedItem = {
  sourceName: string;
  /** The final URL actually retrieved. */
  sourceUrl: string;
  /** Normalized text content (untrusted). */
  content: string;
  /** Real retrieval time. */
  fetchedAt: Date;
};

/**
 * A connector turns a configured source into one or more collected items. Every
 * connector fetches through the hardened HttpFetcher — no connector may reach
 * the network by any other path, so SSRF controls always apply.
 */
export interface Connector {
  readonly kind: SourceKind;
  collect(source: ResearchSource): Promise<CollectedItem[]>;
}

export class ConnectorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConnectorError';
  }
}
