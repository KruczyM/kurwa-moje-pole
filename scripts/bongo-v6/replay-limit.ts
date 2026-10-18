/** Optional replay bounds must not interpret a following CLI flag as NaN. */
export function replayLimit(value: string | undefined, fallback: number): number {
  if (value === undefined || value.startsWith('--')) return fallback;
  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit < 0) throw new Error('Invalid replay bound');
  return limit;
}
