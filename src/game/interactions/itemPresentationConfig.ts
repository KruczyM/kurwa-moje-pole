import type { InspectableItemId } from './itemConfig';

export type ItemPresentation = {
  /** Docelowy największy wymiar modelu leżącego na stole, w jednostkach świata. */
  tableSize: number;
  /** Obrót modelu na stole w radianach: [X, Y, Z]. */
  tableRotation: readonly [number, number, number];
  /** Pozycja na blacie względem środka stołu: [X, Z]. */
  tablePosition: readonly [number, number];
  /** Docelowy największy wymiar modelu w oknie inspekcji. */
  inspectSize: number;
  /** Naturalna orientacja podglądu; domyślnie bez obrotu. */
  inspectRotation: readonly [number, number, number];
  /** Pionowe przesunięcie wycentrowanego modelu w oknie inspekcji. */
  inspectOffsetY: number;
};

/** Tworzy domyślne ustawienia przedmiotu leżącego na stole. */
const lying = (tableSize: number, tablePosition: readonly [number, number]): ItemPresentation => ({
  tableSize,
  tableRotation: [Math.PI / 2, 0, 0],
  tablePosition,
  inspectSize: 1.4,
  inspectRotation: [0, 0, 0],
  inspectOffsetY: 0.08,
});

/**
 * Centralne skale i orientacje używek.
 * Aby zmniejszyć LSD lub grzyby, zmień wyłącznie ich `tableSize` poniżej.
 */
export const itemPresentation: Record<InspectableItemId, ItemPresentation> = {
  joint: lying(0.23, [-0.82, -0.18]),
  cocaine: lying(0.22, [-0.41, 0.18]),
  mdma: lying(0.22, [0, -0.18]),
  mushrooms: lying(0.18, [0.41, 0.18]),
  lsd: lying(0.16, [0.82, -0.18]),
};
