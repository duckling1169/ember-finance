const MAX_LIMIT = 500;

/** Parse and clamp limit/offset query params to sane bounds. */
export function clampPagination(
  limitRaw: string | undefined,
  offsetRaw: string | undefined,
  defaultLimit = 100,
): { limit: number; offset: number } {
  const limitParsed = parseInt(limitRaw ?? '', 10);
  const offsetParsed = parseInt(offsetRaw ?? '', 10);
  const limit = Number.isFinite(limitParsed)
    ? Math.min(Math.max(limitParsed, 1), MAX_LIMIT)
    : defaultLimit;
  const offset = Number.isFinite(offsetParsed) ? Math.max(offsetParsed, 0) : 0;
  return { limit, offset };
}
