import type { EffectId } from '../effects/EffectManager';
export type InspectableItemId = 'joint' | 'cocaine' | 'mdma' | 'mushrooms' | 'lsd';
export type InspectableItem = {
  id: InspectableItemId;
  label: string;
  description: string;
  effect: EffectId;
  /** Liczba egzemplarzy tworzonych na stole przy starcie nowej gry. */
  tableQuantity: number;
};
export const inspectableItems: InspectableItem[] = [
  {
    id: 'joint',
    label: 'Blant',
    description: 'Blant, ktoś oślinił, ale zioło dobre.',
    effect: 'Joint',
    tableQuantity: 1,
  },
  {
    id: 'cocaine',
    label: 'Kreska',
    description: 'Wczoraj padało, trochę wilgotne, ale trzepie jak trzeba.',
    effect: 'Kreska',
    tableQuantity: 1,
  },
  {
    id: 'mdma',
    label: 'MDMA',
    description: 'Ktoś kiedyś powiedział: weź najpierw ćwierć, ale tutaj próbują najpierw po jednej.',
    effect: 'MDMA',
    tableQuantity: 1,
  },
  {
    id: 'mushrooms',
    label: 'Grzyby',
    description:
      'Czas, przestrzeń, jesteśmy wszystkim, jesteśmy niczym, nie chemia, nie proszki, ale hemoglobina.',
    effect: 'Grzyb',
    tableQuantity: 1,
  },
  {
    id: 'lsd',
    label: 'LSD',
    description: 'Jak chcesz zbliżyć się do boga purpury, to weź od razu dwa.',
    effect: 'LSD',
    tableQuantity: 1,
  },
];
export const itemById = new Map(inspectableItems.map((item) => [item.id, item]));
