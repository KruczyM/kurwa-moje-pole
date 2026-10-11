import type { StoryCondition } from '../data/pilotStory';

/** Evaluates only the declared story DSL; content never becomes executable JavaScript. */
export function meetsCondition(
  condition: StoryCondition,
  flags: readonly string[],
  completed: readonly string[],
): boolean {
  switch (condition.type) {
    case 'flag':
      return flags.includes(condition.id);
    case 'quest-complete':
      return completed.includes(condition.id);
    case 'all':
      return condition.conditions.every((child) => meetsCondition(child, flags, completed));
    case 'any':
      return condition.conditions.some((child) => meetsCondition(child, flags, completed));
  }
}
