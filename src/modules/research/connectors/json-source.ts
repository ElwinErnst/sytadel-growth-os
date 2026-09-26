import { z } from 'zod';
import { HttpFetcher } from '../../fetch/http-fetcher';
import { ConnectorError } from './connector';

/**
 * Shared helper for typed connectors that read a public JSON API. Fetches
 * through the hardened HttpFetcher (SSRF controls apply), requires a 2xx
 * response, parses JSON, and validates it against a schema. Any failure becomes
 * a ConnectorError so a bad source is recorded and the batch continues.
 */
export async function fetchJson<T>(
  fetcher: HttpFetcher,
  url: string,
  schema: z.ZodType<T>,
): Promise<T> {
  const res = await fetcher.fetch(url);
  if (res.status < 200 || res.status >= 300) {
    throw new ConnectorError(`Non-success HTTP status ${res.status}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(res.body);
  } catch {
    throw new ConnectorError('Response body is not valid JSON');
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue?.path.join('.') || '(root)';
    throw new ConnectorError(`Unexpected JSON shape at ${where}`);
  }
  return result.data;
}

/** Truncate a snippet to a bounded length for a digest line. */
export function snippet(text: string, max = 200): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}
