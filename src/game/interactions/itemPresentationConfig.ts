import type { InspectableItemId } from './itemConfig';

export type ItemPresentation = {
  /** Docelowy największy wymiar modelu leżącego na stole, w jednostkach świata. */
  tableSize: number;
  /** Obrót modelu na stole w radianach: [X, Y, Z]. */
  tableRotation: readonly [number, number, number];
  /** Docelowy największy wymiar modelu w oknie inspekcji. */
  inspectSize: number;
  /** Naturalna orientacja podglądu; domyślnie bez obrotu. */
  inspectRotation: readonly [number, number, number];
};

/** Tworzy domyślne ustawienia przedmiotu leżącego na stole. */
const lying = (tableSize: number): ItemPresentation => ({
  tableSize,
  tableRotation: [Math.PI / 2, 0, 0],
  inspectSize: 1.4,
  inspectRotation: [0, 0, 0],
});

/**
 * Centralne skale i orientacje używek.
 * Aby zmniejszyć LSD lub grzyby, zmień wyłącznie ich `tableSize` poniżej.
 */
export const itemPresentation: Record<InspectableItemId, ItemPresentation> = {
  joint: lying(0.23),
  cocaine: lying(0.22),
  mdma: lying(0.22),
  mushrooms: lying(0.18),
  lsd: lying(0.16),
};
