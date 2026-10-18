import authored from './data/campaign-v6.json';
import type { ChamberDefinition, LevelDefinition, Point } from './types';

/** O is the single source of truth; its identity is attached to a loose body by createWorld. */
export function adaptGrid(rows: readonly string[]): { rows: string[]; requiredPickups: Point[] } {
  const normalized = rows.map((row) => row.replace(/_/g, ' '));
  return {
    rows: normalized,
    requiredPickups: normalized.flatMap((row, y) =>
      [...row].flatMap((symbol, x) => (symbol === 'O' ? [{ x, y }] : [])),
    ),
  };
}

export function availableLoot(level: Pick<LevelDefinition, 'rows' | 'lootSources' | 'chambers'>): number {
  const count = (room: Pick<ChamberDefinition, 'rows' | 'lootSources'>) =>
    [...room.rows.join('')].filter((c) => 'OQCBUS'.includes(c)).length +
    (room.lootSources?.reduce((n, source) => n + source.count, 0) ?? 0);
  return count(level) + (level.chambers?.reduce((n, room) => n + count(room), 0) ?? 0);
}

/** Candidate data stays separate from the released campaign until every simulation replay passes. */
export function buildCampaignV6(): readonly LevelDefinition[] {
  return (authored as unknown as LevelDefinition[]).map((level) => ({
    ...level,
    ...adaptGrid(level.rows),
    chambers: level.chambers?.map((room) => ({ ...room, ...adaptGrid(room.rows) })),
  }));
}
