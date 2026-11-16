import type { EffectId } from '../effects/EffectManager';
export type InspectableItemId =
  'cigarette' | 'joint' | 'cocaine' | 'mdma' | 'mushrooms' | 'lsd' | 'water' | 'sunglasses';
export type InspectableItem = {
  id: InspectableItemId;
  label: string;
  description: string;
  effect: EffectId;
  /** Liczba egzemplarzy wykładanych przy starcie gry. */
  tableQuantity: number;
  location: 'camp' | 'market';
};
export const inspectableItems: InspectableItem[] = [
  {
    id: 'cigarette',
    location: 'camp',
    label: 'Papieros',
    description: 'Pojedynczy papieros z filtrem, zostawiony na obozowym stole.',
    effect: 'Papieros',
    tableQuantity: 1,
  },
  {
    id: 'joint',
    location: 'market',
    label: 'Blant',
    description: 'Blant, ktoś oślinił, ale zioło dobre.',
    effect: 'Joint',
    tableQuantity: 1,
  },
  {
    id: 'cocaine',
    location: 'market',
    label: 'Kreska',
    description: 'Wczoraj padało, trochę wilgotne, ale trzepie jak trzeba.',
    effect: 'Kreska',
    tableQuantity: 1,
  },
  {
    id: 'mdma',
    location: 'market',
    label: 'MDMA',
    description: 'Ktoś kiedyś powiedział: weź najpierw ćwierć, ale tutaj próbują najpierw po jednej.',
    effect: 'MDMA',
    tableQuantity: 1,
  },
  {
    id: 'mushrooms',
    location: 'market',
    label: 'Grzyby',
    description:
      'Czas, przestrzeń, jesteśmy wszystkim, jesteśmy niczym, nie chemia, nie proszki, ale hemoglobina.',
    effect: 'Grzyb',
    tableQuantity: 1,
  },
  {
    id: 'lsd',
    location: 'market',
    label: 'LSD',
    description: 'Jak chcesz zbliżyć się do boga purpury, to weź od razu dwa.',
    effect: 'LSD',
    tableQuantity: 1,
  },
  {
    id: 'water',
    location: 'camp',
    label: 'Woda mineralna',
    description: 'Butelka chłodnej wody niegazowanej. Znakomicie nawadnia i skraca trwający trip o 40%.',
    effect: 'Woda',
    tableQuantity: 1,
  },
  {
    id: 'sunglasses',
    location: 'camp',
    label: 'Okulary przeciwsłoneczne',
    description: 'Stylowe ciemne okulary festiwalowe. Redukują oślepiający bloom i ekspozycję o 50%.',
    effect: 'Okulary',
    tableQuantity: 1,
  },
];
export const itemById = new Map(inspectableItems.map((item) => [item.id, item]));
