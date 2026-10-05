import type { EffectId } from '../effects/EffectManager';

export type ConsumableItemId = EffectId;

export const WATER_TRIP_REDUCTION = 0.4;
export const SUNGLASSES_BLOOM_REDUCTION = 0.5;
export const SUNGLASSES_EXPOSURE_REDUCTION = 0.5;
export const SUNGLASSES_DURATION = 60;

export const inventoryEffects: readonly EffectId[] = [
  'Piwo',
  'Papieros',
  'Joint',
  'Kreska',
  'Grzyb',
  'MDMA',
  'LSD',
  'Woda',
  'Okulary',
];

export const DEFAULT_STARTER_INVENTORY: Partial<Record<EffectId, number>> = {
  Piwo: 2,
  Papieros: 2,
  Joint: 2,
  Kreska: 1,
  Grzyb: 1,
  MDMA: 1,
  LSD: 1,
  Woda: 2,
  Okulary: 1,
};

/** Przechowuje ilości używek oraz przedmiotów użytkowych bez powiązania z HTML-em ani sceną Three.js. */
export class ConsumableInventory {
  private readonly quantities = new Map<EffectId, number>();

  constructor(initialQuantities?: Partial<Record<EffectId, number>>) {
    inventoryEffects.forEach((effect) => {
      this.quantities.set(effect, initialQuantities?.[effect] ?? 0);
    });
  }

  /** Zwraca aktualną, zawsze nieujemną ilość danego przedmiotu. */
  quantity(effect: EffectId) {
    return this.quantities.get(effect) ?? 0;
  }

  /** Dodaje konfigurowalną liczbę egzemplarzy do plecaka. */
  add(effect: EffectId, amount = 1) {
    if (!Number.isInteger(amount) || amount < 1)
      throw new Error('Ilość do dodania musi być dodatnią liczbą całkowitą.');
    this.quantities.set(effect, this.quantity(effect) + amount);
  }

  /** Zużywa jeden egzemplarz i informuje, czy operacja była możliwa. */
  consume(effect: EffectId) {
    const current = this.quantity(effect);
    if (current < 1) return false;
    this.quantities.set(effect, current - 1);
    return true;
  }

  /** Używa wody jako antidotum, skracając trwający trip o 40%. */
  useWater(target: { shortenActiveEffect: (factor: number) => boolean | void }): boolean {
    if (this.quantity('Woda') < 1) return false;
    this.consume('Woda');
    target.shortenActiveEffect(WATER_TRIP_REDUCTION);
    return true;
  }

  /** Używa okularów redukując bloom i ekspozycję o 50% na czas trwania (60s). */
  useSunglasses(target: { applySunglasses: (durationSeconds?: number) => void }): boolean {
    if (this.quantity('Okulary') < 1) return false;
    this.consume('Okulary');
    target.applySunglasses(SUNGLASSES_DURATION);
    return true;
  }

  /** Zwraca łączną liczbę przedmiotów znajdujących się w plecaku. */
  get total() {
    let result = 0;
    this.quantities.forEach((quantity) => (result += quantity));
    return result;
  }
}
