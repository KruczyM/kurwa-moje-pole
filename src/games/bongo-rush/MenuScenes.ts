import { HEROES } from './Progress';

/** Complete roster: original Amper plus fourteen scenes based on authoritative references. */
export const PAINTED_MENU_HEROES = HEROES;

export function hasMenuScene(hero: string): boolean {
  return PAINTED_MENU_HEROES.includes(hero as (typeof PAINTED_MENU_HEROES)[number]);
}

/** Amper keeps his original artwork; every other hero has a fully painted scene. */
export function menuSceneFile(hero: string): string {
  return hero === 'amper' || !hasMenuScene(hero) ? 'scene.webp' : `scenes/${hero}.webp`;
}
