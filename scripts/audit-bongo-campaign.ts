import { writeFileSync, mkdirSync } from 'node:fs';
import { LEVELS } from '../src/games/bongo-rush/Levels';
import { auditDifficulty, auditPatrols } from '../src/games/bongo-rush/DifficultyAudit';

const report = LEVELS.map((level) => {
  return {
    ...auditDifficulty(level),
    ...auditPatrols(level),
    title: level.title,
    style: level.style ?? 'challenge',
    alternatives: (level.alternateReplays ?? level.alternatives)?.map((route) => ({
      name: route.name,
      moves: route.inputs.length,
      ...auditPatrols(level, route.inputs),
    })),
  };
});
mkdirSync('reports/bongo-campaign-v4', { recursive: true });
writeFileSync(
  `reports/bongo-campaign-v4/${process.argv[2] ?? 'audit'}.json`,
  JSON.stringify(report, null, 2),
);
writeFileSync(
  'reports/bongo-campaign-v4/browser-routes.json',
  JSON.stringify(
    LEVELS.map((level) => ({
      id: level.id,
      style: level.style ?? 'challenge',
      solution: level.replay ?? level.solution,
    })),
  ),
);
console.log(JSON.stringify(report));
