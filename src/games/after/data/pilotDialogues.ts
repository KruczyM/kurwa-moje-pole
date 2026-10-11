import type { DialogueDefinition } from '../story/DialogueTypes';

export const PILOT_DIALOGUE_FLAGS = ['flag-hint-heard', 'friend-reassured', 'light-hint-heard'] as const;

/** Optional authored conversations; skipping a dialogue never blocks the main quest route. */
export const PILOT_DIALOGUES: readonly DialogueDefinition[] = [
  {
    id: 'witness-talk',
    npcId: 'witness',
    speaker: 'Świadek z sąsiedniego obozu',
    targetId: 'witness',
    entry: 'greeting',
    nodes: [
      {
        id: 'greeting',
        text: 'Wasza flaga? Widziałem trzy. Jedna szła sama, ale to chyba był człowiek pod spodem.',
        choices: [
          {
            id: 'ask',
            text: 'Pomożesz nam znaleźć tę właściwą?',
            next: 'hint',
            effects: [
              { type: 'trust', npcId: 'witness', delta: 1 },
              { type: 'set-flag', id: 'flag-hint-heard' },
            ],
          },
          { id: 'leave', text: 'Wrócimy później.', next: null },
        ],
      },
      {
        id: 'hint',
        text: 'Szukaj na północnym wschodzie, za namiotem. Jak zobaczysz naszą flagę, nie zamieniaj ich znowu.',
        choices: [
          { id: 'repeat', text: 'Jeszcze raz, gdzie?', next: 'hint' },
          {
            id: 'shortcut',
            text: 'A którędy najlepiej przejść?',
            next: 'shortcut',
            requires: { type: 'trust-at-least', npcId: 'witness', value: 1 },
          },
          { id: 'thanks', text: 'Dzięki. Tym razem sprawdzimy napis.', next: null },
        ],
      },
      {
        id: 'shortcut',
        text: 'Obejdź namiot od wschodu. Linki tylko straszą, ale przez środek namiotu nie przejdziesz.',
        choices: [
          { id: 'back', text: 'Powtórz główną wskazówkę.', next: 'hint' },
          { id: 'leave', text: 'Mamy to. Dzięki!', next: null },
        ],
      },
    ],
  },
  {
    id: 'friend-talk',
    npcId: 'friend',
    speaker: 'Zagubiony znajomy',
    targetId: 'friend',
    entry: 'greeting',
    nodes: [
      {
        id: 'greeting',
        text: 'Nie zgubiłem się. Po prostu ten obóz przesunął się, kiedy nie patrzyłem.',
        choices: [
          {
            id: 'reassure',
            text: 'Najważniejsze, że jesteś. Wracamy razem.',
            next: 'return',
            effects: [
              { type: 'trust', npcId: 'friend', delta: 1 },
              { type: 'set-flag', id: 'friend-reassured' },
            ],
          },
          {
            id: 'tease',
            text: 'Obóz stoi. To ty poszedłeś za nie tą flagą.',
            next: 'return',
            effects: [{ type: 'trust', npcId: 'friend', delta: -1 }],
          },
          { id: 'leave', text: 'Zaczekaj, jeszcze sprawdzę okolicę.', next: null },
        ],
      },
      {
        id: 'return',
        text: 'Dobra. Zbierzcie flagę, sprawdźcie światło i spotkajmy się przy wejściu do naszego obozu.',
        choices: [
          { id: 'repeat', text: 'Co jeszcze zostało?', next: 'return' },
          { id: 'leave', text: 'Do zobaczenia przy wejściu.', next: null },
        ],
      },
    ],
  },
  {
    id: 'technician-talk',
    npcId: 'technician',
    speaker: 'Techniczny od ostatniej lampy',
    targetId: 'technician',
    entry: 'greeting',
    nodes: [
      {
        id: 'greeting',
        text: 'Ta lampa ma jeden tryb: jeszcze chwilę. Przydałoby się, żeby ta chwila trwała do naszego powrotu.',
        choices: [
          {
            id: 'ask',
            text: 'Jak pomożemy w obozowej zagadce?',
            next: 'hint',
            effects: [
              { type: 'trust', npcId: 'technician', delta: 1 },
              { type: 'set-flag', id: 'light-hint-heard' },
            ],
          },
          {
            id: 'connected',
            text: 'Kabel jest już na miejscu.',
            next: 'ready',
            requires: { type: 'flag', id: 'interaction:cable' },
          },
          { id: 'leave', text: 'Sprawdzę to za chwilę.', next: null },
        ],
      },
      {
        id: 'hint',
        text: 'Znajdź znacznik kabla na zachód stąd, potem wróć do znacznika zasilania. Możesz zrobić to sam albo podzielić zadania z ekipą.',
        choices: [
          { id: 'repeat', text: 'Powtórz kolejność.', next: 'hint' },
          { id: 'leave', text: 'Jasne. Najpierw kabel, potem zasilanie.', next: null },
        ],
      },
      {
        id: 'ready',
        text: 'To teraz znacznik zasilania. Potem łapcie resztę ekipy i wracajcie do obozu.',
        choices: [{ id: 'leave', text: 'Dzięki!', next: null }],
      },
    ],
  },
];
