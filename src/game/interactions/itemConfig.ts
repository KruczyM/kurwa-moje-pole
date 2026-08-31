import type { EffectId } from '../effects/EffectManager';
export type InspectableItemId = 'joint' | 'cocaine' | 'mdma' | 'mushrooms' | 'lsd';
export type InspectableItem = { id: InspectableItemId; label: string; description: string; effect: EffectId };
export const inspectableItems: InspectableItem[] = [
  {
    id: 'joint',
    label: 'Blant',
    description: 'Blant, ktoś oślinił, ale zioło dobre. Fikcyjny rekwizyt uruchamiający efekt wizualny gry.',
    effect: 'Joint',
  },
  {
    id: 'cocaine',
    label: 'Kreska',
    description: 'Wczoraj padało, trochę wilgotne — w grze daje szybki, chłodny efekt percepcji.',
    effect: 'Kreska',
  },
  {
    id: 'mdma',
    label: 'MDMA',
    description: 'Fikcyjny rekwizyt imprezowy: ciepłe światło, nasycenie i miękka poświata w grze.',
    effect: 'MDMA',
  },
  {
    id: 'mushrooms',
    label: 'Grzyby',
    description:
      'Czas, przestrzeń, jesteśmy wszystkim, jesteśmy niczym — nie chemia, nie proszki, ale hemoglobina.',
    effect: 'Grzyb',
  },
  {
    id: 'lsd',
    label: 'LSD',
    description: 'Jeśli chcesz zbliżyć się do boga purpury, uruchom fikcyjny purpurowy efekt percepcji gry.',
    effect: 'LSD',
  },
];
export const itemById = new Map(inspectableItems.map((item) => [item.id, item]));
