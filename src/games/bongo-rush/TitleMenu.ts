import { LEVELS } from './Levels';
import type { Progress } from './Progress';

export const MENU_BIOMES = ['Magazyn Amarena', 'Korzenie', 'Kryształowy rave', 'Cytadela'] as const;

/** Old saves resume their highest unlock; untrusted saves cannot select a locked level. */
export function continueLevel(progress: Pick<Progress, 'unlocked' | 'lastLevel'>): number {
  const unlocked = Math.max(1, Math.min(LEVELS.length, Math.trunc(progress.unlocked) || 1));
  return Number.isInteger(progress.lastLevel) && progress.lastLevel! > 0
    ? Math.min(unlocked, progress.lastLevel!)
    : unlocked;
}

/** Cards retain real global level indices, including each biome's final challenge. */
export function biomeMenu(biome: number, unlocked: number, preferredLevel: number) {
  const levels = LEVELS.filter((level) => level.biome === biome);
  const available = levels.filter((level) => level.id <= unlocked);
  const preferred = available.find((level) => level.id === preferredLevel);
  return { total: levels.length, available: available.length, level: preferred?.id ?? available[0]?.id };
}
