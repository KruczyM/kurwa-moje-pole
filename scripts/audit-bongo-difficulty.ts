import { mkdirSync, writeFileSync } from 'node:fs';
import { LEVELS } from '../src/games/bongo-rush/Levels';
import { auditDifficulty, runGreedyProbe } from '../src/games/bongo-rush/DifficultyAudit';

const results = LEVELS.map((level) => ({ ...auditDifficulty(level), greedy: runGreedyProbe(level) }));
mkdirSync('reports/bongo-difficulty', { recursive: true });
writeFileSync(
  'reports/bongo-difficulty/audit.json',
  JSON.stringify(
    {
      warning:
        'These mechanics and naive probes do not measure subjective human difficulty or prove no shorter solution exists.',
      levels: results,
    },
    null,
    2,
  ) + '\n',
);
console.table(
  results.map(({ greedy, ...mechanics }) => ({
    ...mechanics,
    greedy: greedy.status,
    greedySteps: greedy.steps,
  })),
);
