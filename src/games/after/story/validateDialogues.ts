import type { StoryCondition } from '../data/pilotStory';
import type { DialogueDefinition } from './DialogueTypes';
import { MIN_TRUST, MAX_TRUST } from './Relationships';

interface References {
  targetIds: readonly string[];
  questIds: readonly string[];
  flagIds: readonly string[];
}

/** Validates typed offline dialogue content, including reachability and unconditional escape routes. */
export function validateDialogues(definitions: readonly DialogueDefinition[], references: References): void {
  const ids = new Set<string>();
  const targets = new Set<string>();
  const npcIds = new Set(definitions.map((definition) => definition.npcId));
  const flags = new Set(references.flagIds);
  /** Enforces stable plain IDs so data cannot collide with object/prototype keys or path syntax. */
  const validId = (id: string) => /^[a-z][a-z0-9-]*$/.test(id);
  /** Validates nested story-condition leaves against an explicit content registry. */
  function checkCondition(condition: StoryCondition): void {
    if (condition.type === 'all' || condition.type === 'any') {
      if (!condition.conditions.length) throw new Error('Empty After dialogue condition');
      condition.conditions.forEach(checkCondition);
    } else if (condition.type === 'flag') {
      if (!flags.has(condition.id)) throw new Error('Unknown After dialogue flag');
    } else if (condition.type !== 'quest-complete' || !references.questIds.includes(condition.id))
      throw new Error('Unknown After dialogue quest/operation');
  }
  for (const definition of definitions) {
    if (
      !validId(definition.id) ||
      ids.has(definition.id) ||
      !validId(definition.npcId) ||
      !definition.speaker.trim() ||
      targets.has(definition.targetId) ||
      !references.targetIds.includes(definition.targetId)
    )
      throw new Error('Invalid After dialogue definition');
    ids.add(definition.id);
    targets.add(definition.targetId);
    const nodes = new Map(definition.nodes.map((node) => [node.id, node]));
    if (nodes.size !== definition.nodes.length || !nodes.has(definition.entry))
      throw new Error('Invalid After dialogue entry/nodes');
    for (const node of nodes.values()) {
      if (!validId(node.id) || !node.text.trim() || !node.choices.length)
        throw new Error('Invalid After dialogue node');
      const choices = new Set<string>();
      for (const choice of node.choices) {
        if (
          !validId(choice.id) ||
          choices.has(choice.id) ||
          !choice.text.trim() ||
          (choice.next !== null && !nodes.has(choice.next))
        )
          throw new Error('Invalid After dialogue choice');
        choices.add(choice.id);
        if (choice.requires?.type === 'trust-at-least') {
          if (
            !npcIds.has(choice.requires.npcId) ||
            !Number.isInteger(choice.requires.value) ||
            choice.requires.value < MIN_TRUST ||
            choice.requires.value > MAX_TRUST
          )
            throw new Error('Invalid After trust condition');
        } else if (choice.requires) checkCondition(choice.requires);
        for (const effect of choice.effects ?? []) {
          if (effect.type === 'trust') {
            if (
              !npcIds.has(effect.npcId) ||
              !Number.isInteger(effect.delta) ||
              Math.abs(effect.delta) > MAX_TRUST
            )
              throw new Error('Invalid After dialogue trust effect');
          } else if (effect.type !== 'set-flag' || !validId(effect.id) || !flags.has(effect.id))
            throw new Error('Invalid After dialogue flag effect/operation');
        }
      }
    }
    const reachable = new Set<string>([definition.entry]);
    const queue = [definition.entry];
    for (let i = 0; i < queue.length; i++) {
      for (const choice of nodes.get(queue[i])!.choices) {
        if (choice.next !== null && !reachable.has(choice.next)) {
          reachable.add(choice.next);
          queue.push(choice.next);
        }
      }
    }
    if (reachable.size !== nodes.size) throw new Error('Unreachable After dialogue node');
    const exits = new Set<string>();
    let changed = true;
    while (changed) {
      changed = false;
      for (const node of nodes.values()) {
        if (
          !exits.has(node.id) &&
          node.choices.some((choice) => !choice.requires && (choice.next === null || exits.has(choice.next)))
        ) {
          exits.add(node.id);
          changed = true;
        }
      }
    }
    if (exits.size !== nodes.size) throw new Error('After dialogue needs unconditional exit from every node');
  }
}
