import { createHash } from 'node:crypto';

/** SHA-256 hex digest of a UTF-8 string. */
export function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Normalize a claim for deduplication: lowercase, collapse whitespace, trim,
 * strip trailing punctuation. Two claims that differ only cosmetically produce
 * the same fingerprint.
 */
export function fingerprint(statement: string): string {
  const normalized = statement
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?]+$/g, '')
    .trim();
  return sha256(normalized);
}
