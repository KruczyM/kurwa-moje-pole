export const VISUAL_THEMES = ['storybook', 'luminous', 'mysterious'] as const;
export type VisualTheme = 'standard' | (typeof VISUAL_THEMES)[number];
export const MENU_VISUAL_THEMES = ['standard', 'storybook'] as const;
export type CollectibleStyle = 'festival' | 'fantasy';
export interface PresentationPreferences {
  visualTheme: VisualTheme;
  collectibleStyle: CollectibleStyle;
}
export const THEME_LABELS: Record<VisualTheme, string> = {
  standard: 'Standardowy',
  storybook: 'Artystyczny',
  luminous: 'Świetlista fantazja · podgląd',
  mysterious: 'Tajemnicze podziemia · podgląd',
};
export const THEME_ACCENTS: Record<VisualTheme, string> = {
  standard: '#8bdbab',
  storybook: '#edc087',
  luminous: '#99eee1',
  mysterious: '#b4b5d8',
};
const FESTIVAL = ['Amareny', 'Liście', 'Cukierki', 'Bonga'];
const TREASURES: Record<VisualTheme, readonly string[]> = {
  standard: FESTIVAL,
  storybook: ['Bursztynowe amulety', 'Leśne nasiona', 'Kryształowe rozety', 'Relikwiarze'],
  luminous: ['Słoneczne odłamki', 'Świetliste pąki', 'Pryzmatyczne gwiazdy', 'Opalowe serca'],
  mysterious: ['Starożytne medaliony', 'Runiczne szyszki', 'Ametystowe pieczęcie', 'Obsydianowe talizmany'],
};
export function presentationPreferences(value: Partial<PresentationPreferences>): PresentationPreferences {
  return {
    visualTheme:
      value.visualTheme === 'standard' ||
      VISUAL_THEMES.includes(value.visualTheme as (typeof VISUAL_THEMES)[number])
        ? value.visualTheme!
        : 'storybook',
    collectibleStyle:
      value.visualTheme !== 'standard' && value.collectibleStyle === 'fantasy' ? 'fantasy' : 'festival',
  };
}
export function collectibleName(preferences: PresentationPreferences, biome: number): string {
  return (preferences.collectibleStyle === 'festival' ? FESTIVAL : TREASURES[preferences.visualTheme])[biome];
}
/** Material sampling is fixed in world space, independently of camera position. */
export function macroVariant(x: number, y: number, material = 0): number {
  return material * 16 + (((y % 4) + 4) % 4) * 4 + (((x % 4) + 4) % 4);
}
export function macroRect(kind: 'wall' | 'floor', variant: number) {
  return {
    x: (variant % 4) * 128 + (kind === 'wall' ? Math.floor(variant / 16) * 512 : 0),
    y: Math.floor((variant % 16) / 4) * 128,
    width: 128,
    height: 128,
  };
}
export function presentationPath(base: string, preferences: PresentationPreferences, biome: number) {
  const pack =
    preferences.visualTheme === 'storybook' || preferences.visualTheme === 'standard'
      ? 'storybook-v3'
      : `themes-preview/${preferences.visualTheme}`;
  return `${base}game-assets/2d/bongo-rush/${pack}/${['amarena', 'roots', 'rave', 'smoke'][biome]}`;
}

/** Menu and HUD show the same object raster as the active renderer. */
export function collectiblePreviewPath(base: string, preferences: PresentationPreferences, biome: number) {
  if (
    preferences.visualTheme === 'standard' ||
    (preferences.visualTheme === 'storybook' && preferences.collectibleStyle === 'fantasy')
  ) {
    const style = preferences.visualTheme === 'standard' ? 'standard' : 'fantasy';
    return `${base}game-assets/2d/bongo-rush/authored-v6/${style}-items-${biome}.webp`;
  }
  return `${presentationPath(base, preferences, biome)}/items-preview.png`;
}

/** Use existing painted compositions, preserving each image's own aspect ratio. */
export function paintedSoilPath(
  base: string,
  preferences: PresentationPreferences,
  level: number,
  biome: number,
): string | undefined {
  if (preferences.visualTheme !== 'storybook') return undefined;
  const authored = [1, 2, 5, 6, 7, 8, 9, 10, 20];
  const selected = authored.includes(level)
    ? level
    : biome === 0
      ? 1
      : biome === 1
        ? 6
        : biome === 3
          ? 20
          : undefined;
  return selected
    ? `${base}game-assets/2d/bongo-rush/storybook-v3/soil/level_${String(selected).padStart(2, '0')}_soil.png`
    : `${presentationPath(base, preferences, biome)}/soil.png`;
}

/** Painted stone courses span eight cells, keeping 64 source pixels per logical tile. */
export function paintedWallVariant(x: number, y: number, material = 0): number {
  return material * 64 + (((y % 8) + 8) % 8) * 8 + (((x % 8) + 8) % 8);
}
export function paintedWallRect(variant: number) {
  return {
    x: Math.floor(variant / 64) * 512 + (variant % 8) * 64,
    y: Math.floor((variant % 64) / 8) * 64,
    width: 64,
    height: 64,
  };
}
