import { HEROES } from './Progress';

export type MenuScreen = 'title' | 'heroes' | 'levels';

/** Cosmetic menu navigation is deliberately independent of simulation and saved progress. */
export class MenuFlow {
  screen: MenuScreen = 'title';
  hero: string;
  confirmed = false;

  /** Highlights the saved hero without silently confirming a new run. */
  constructor(savedHero: string) {
    this.hero = HEROES.includes(savedHero as (typeof HEROES)[number]) ? savedHero : HEROES[0];
  }

  /** Main's quick-level entry keeps the selected hero without reopening the gallery. */
  openLevels(): void {
    this.screen = 'levels';
    this.confirmed = true;
  }

  /** Opens the gallery; every fresh visit requires explicit confirmation. */
  openHeroes(): void {
    this.screen = 'heroes';
    this.confirmed = false;
  }

  /** Rejects non-playable names, including Kobra, before selecting cosmetic artwork. */
  choose(hero: string): boolean {
    if (this.screen !== 'heroes' || !HEROES.includes(hero as (typeof HEROES)[number])) return false;
    this.hero = hero;
    this.confirmed = false;
    return true;
  }

  /** Returns to the title so the chosen scene precedes Continue or level selection. */
  confirm(): void {
    if (this.screen !== 'heroes') return;
    this.confirmed = true;
    this.screen = 'title';
  }

  /** Escape/back moves one menu page without affecting paused gameplay. */
  back(): void {
    if (this.screen === 'levels') this.openHeroes();
    else if (this.screen === 'heroes') this.screen = 'title';
  }

  /** A title return cannot reuse an old implicit confirmation. */
  title(): void {
    this.screen = 'title';
    this.confirmed = false;
  }

  /** Applies the same character and level guards to keyboard, pointer and touch starts. */
  canStart(index: number, unlocked: number): boolean {
    return (
      this.screen === 'levels' && this.confirmed && Number.isInteger(index) && index >= 0 && index < unlocked
    );
  }
}
