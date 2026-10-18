import { presentationPreferences } from './Presentation';
import { musicPack } from './Soundtrack';
import type { MusicPack } from './Soundtrack';
import type { PresentationPreferences } from './Presentation';
import { CAMPAIGN_LEVEL_COUNT, LEVEL_COUNT } from './Campaign';

export const HEROES = [
  'amper',
  'antena',
  'gruczol',
  'klatwa',
  'krwiak',
  'pien',
  'pierscien',
  'zawor',
  'ambona',
  'chlebak',
  'dziaslo',
  'hemoroid',
  'jeczmien',
  'korba',
  'szerszen',
] as const;
export const HERO_LABELS = [
  'Amper',
  'Antena',
  'Gruczoł',
  'Klątwa',
  'Krwiak',
  'Pień',
  'Pierścień',
  'Zawór',
  'Ambona',
  'Chlebak',
  'Dziąsło',
  'Hemoroid',
  'Jęczmień',
  'Korba',
  'Szerszeń',
];
export interface Progress extends PresentationPreferences {
  musicPack: MusicPack;
  version: 1;
  unlocked: number;
  hero: string;
  lastLevel?: number;
  muted: boolean;
  completed: boolean;
  campaignRevision: 3;
}
const KEY = 'after-bongo-rush:v1';

/** Validates untrusted browser storage and tolerates private-mode/security failures. */
export function loadProgress(storage: Pick<Storage, 'getItem'>): Progress {
  const defaults: Progress = {
    musicPack: 'pack-1',
    ...presentationPreferences({}),
    version: 1,
    campaignRevision: 3,
    unlocked: 1,
    hero: 'amper',
    muted: false,
    completed: false,
  };
  try {
    const data = JSON.parse(storage.getItem(KEY) ?? 'null');
    if (!data || data.version !== 1) return defaults;
    const oldCampaign = data.campaignRevision === undefined || data.campaignRevision === 1;
    const currentCampaign = data.campaignRevision === 3;
    const unlocked = Number.isInteger(data.unlocked) ? Math.max(1, data.unlocked) : 1;
    const migrated =
      oldCampaign && (unlocked >= 13 || data.completed === true)
        ? Math.max(21, Math.min(24, unlocked + 8))
        : unlocked;
    const available = Math.max(
      !oldCampaign && data.completed === true ? CAMPAIGN_LEVEL_COUNT + 1 : 1,
      Math.min(LEVEL_COUNT, migrated),
    );
    return {
      musicPack: musicPack(data.musicPack),
      ...presentationPreferences(data),
      version: 1,
      campaignRevision: 3,
      unlocked: available,
      ...(Number.isInteger(data.lastLevel) && data.lastLevel >= 1 && data.lastLevel <= LEVEL_COUNT
        ? { lastLevel: Math.min(data.lastLevel, available) }
        : {}),
      hero: HEROES.includes(data.hero) ? data.hero : 'amper',
      muted: data.muted === true,
      completed: currentCampaign && data.completed === true,
    };
  } catch {
    return defaults;
  }
}

/** Saves only campaign preferences, not mutable simulation objects or private data. */
export function saveProgress(storage: Pick<Storage, 'setItem'>, progress: Progress): void {
  try {
    storage.setItem(KEY, JSON.stringify(progress));
  } catch {
    /* Playing remains possible without persistent storage. */
  }
}
