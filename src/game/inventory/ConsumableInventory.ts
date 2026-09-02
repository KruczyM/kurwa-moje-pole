import type { EffectId } from '../effects/EffectManager';

export const inventoryEffects: readonly EffectId[] = [
  'Piwo',
  'Papieros',
  'Joint',
  'Kreska',
  'Grzyb',
  'MDMA',
  'LSD',
];

/** Przechowuje ilości używek bez powiązania z HTML-em ani sceną Three.js. */
export class ConsumableInventory {
  private readonly quantities = new Map<EffectId, number>(inventoryEffects.map((effect) => [effect, 0]));

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

  /** Zwraca łączną liczbę przedmiotów znajdujących się w plecaku. */
  get total() {
    let result = 0;
    this.quantities.forEach((quantity) => (result += quantity));
    return result;
  }
}
