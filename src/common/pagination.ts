/**
 * Pagination for read/list operations. Defaults are conservative; limit is
 * clamped so a caller cannot ask for an unbounded page.
 */
export type PageParams = {
  limit: number;
  offset: number;
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/** Build clamped page params from optional raw string inputs (e.g. CLI flags). */
export function toPageParams(
  limitRaw?: string,
  offsetRaw?: string,
): PageParams {
  const limit = clampInt(limitRaw, DEFAULT_LIMIT, 1, MAX_LIMIT);
  const offset = clampInt(offsetRaw, 0, 0, Number.MAX_SAFE_INTEGER);
  return { limit, offset };
}

function clampInt(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (raw === undefined) return fallback;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}
