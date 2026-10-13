import { buildCave } from './CaveBuilder';
import type { CaveSketch } from './CaveBuilder';
import type { LevelDefinition } from './types';
import { buildChallenges } from './ChallengeCaves';
import { EXIT_PUZZLES } from './ExitPuzzles';

export const BIOMES = [
  {
    name: 'Magazyn Amarena',
    item: 'Amareny',
    wall: '#66544c',
    soil: '#453630',
    light: '#e7b37b',
    accent: '#ff9b83',
    background: 'art-v2/amarena-background.png',
  },
  {
    name: 'Zielone podziemia',
    item: 'Liście',
    wall: '#3d6255',
    soil: '#283e35',
    light: '#b4d98b',
    accent: '#83e67b',
    background: 'art-v2/roots-background.png',
  },
  {
    name: 'Neonowy rave',
    item: 'Cukierki',
    wall: '#514569',
    soil: '#342b44',
    light: '#bba0d9',
    accent: '#83dadb',
    background: 'art-v2/rave-background.png',
  },
  {
    name: 'Dymna grota',
    item: 'Bonga',
    wall: '#657b88',
    soil: '#354b55',
    light: '#d5f0f4',
    accent: '#b0e8ed',
    background: 'art-v2/glass-background.png',
  },
] as const;

/** Stable campaign identities; authored builders alternate mining choices and compact reasoning. */
export const CAVE_SKETCHES: readonly CaveSketch[] = [
  {
    title: 'Podziemna hurtownia',
    hint: 'Trzy butelki wystarczą. Wybierz złoża albo pułapkę przy patrolu; nie musisz czyścić całej kopalni.',
  },
  {
    title: 'Szyby dostawcze',
    hint: 'Dwie zasuwy: przygotuj wnękę górnym obejściem, zanim pchniesz głaz. Patrol pilnuje krótszego dojścia; górna droga jest bezpieczna.',
  },
  {
    title: 'Magazyn pod zwałem',
    hint: 'Złoże pod kominem ma boczny odwrót. Wybierz kieszenie wydobywcze lub przejmij łup patrolu zamiast wracać do wszystkich złóż.',
  },
  {
    title: 'Katakumby korzeni',
    hint: 'W jednokierunkowej żyle skały zamykają odwrót. Zbierz łup przed uruchomieniem Kobry na przejściu do spustu.',
  },
  {
    title: 'Zielony labirynt',
    hint: 'Niebieski patrol obchodzi filar. Masz kilka złóż i dwa obejścia; Kobra na środkowym skrzyżowaniu może odciąć skrót.',
  },
  {
    title: 'Serce kolonii',
    hint: 'Każdy szyb opróżniaj z bocznej wnęki. Za Kobrą trzeba przygotować dwie zasuwy z przeciwnych stron.',
  },
  {
    title: 'Kopalnia basu',
    hint: 'Undercover reaguje na prostą linię wzroku. Przerwij ją ziemią lub filarem; wybierz inne złoże albo przygotuj pułapkę.',
  },
  {
    title: 'Neonowe uskoki',
    hint: 'Zachowaj obejście: górna zasuwa idzie w prawo, dolna w lewo. Kolejna komora wymaga przygotowania górnego głazu.',
  },
  {
    title: 'Rave pod lawiną',
    hint: 'Możesz wybrać komin z górnym obejściem, jednokierunkową żyłę lub łup z pułapki. Przy lawinie najpierw przygotuj odwrót.',
  },
  {
    title: 'Kryształowe głębiny',
    hint: 'Najpierw odbierz łup spod komina, potem przygotuj dwie przeciwne zasuwy. Nie zatkaj dolnego przejścia.',
  },
  {
    title: 'Dwanaście podziemnych dróg',
    hint: 'Wybieraj spośród pięciu złóż i dwóch osobnych patroli. Zostaw boczny tunel na powrót, zanim odkopiesz podporę.',
  },
  {
    title: 'Twierdza Tasiora',
    hint: 'Przygotuj komory skalne, potem pchnij głaz dwa razy w prawo do zagrody bossa. Cofnij się w lewo i zejdź do wyjścia.',
  },
];

export const LEVELS: readonly LevelDefinition[] = [
  ...CAVE_SKETCHES.map(buildCave),
  ...buildChallenges(EXIT_PUZZLES),
];
