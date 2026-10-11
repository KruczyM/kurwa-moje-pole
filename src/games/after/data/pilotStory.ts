import type { MapDefinition } from '../simulation/WorldState';

/** Closed, serializable DSL: no scripts, executable expressions or dynamic imports in content. */
export type StoryCondition =
  | { type: 'flag'; id: string }
  | { type: 'quest-complete'; id: string }
  | { type: 'all'; conditions: readonly StoryCondition[] }
  | { type: 'any'; conditions: readonly StoryCondition[] };

export interface PilotQuest {
  id: string;
  title: string;
  steps: readonly { id: string; targetId: string; requires?: StoryCondition }[];
  completion: StoryCondition;
  rewardFlag: string;
  failForward: string;
}

export const PILOT_CHARACTERS = ['Amper', 'Chlebak'] as const;

export const PILOT_QUESTS: readonly PilotQuest[] = [
  {
    id: 'recover-flag',
    title: 'Czyja to flaga?',
    steps: [
      { id: 'ask-witness', targetId: 'witness' },
      { id: 'recover', targetId: 'flag' },
    ],
    completion: { type: 'flag', id: 'interaction:flag' },
    rewardFlag: 'flag-recovered',
    failForward: 'Rozmowa podpowiada miejsce, ale flagę można odnaleźć samodzielnie.',
  },
  {
    id: 'find-friend',
    title: 'Jeszcze ktoś nie wrócił',
    steps: [
      { id: 'listen', targetId: 'radio' },
      { id: 'follow', targetId: 'tracks' },
      { id: 'meet', targetId: 'friend' },
    ],
    completion: { type: 'flag', id: 'interaction:friend' },
    rewardFlag: 'friend-found',
    failForward: 'Radio i ślady są alternatywnymi wskazówkami, nie blokują odnalezienia znajomego.',
  },
  {
    id: 'restore-light',
    title: 'Jeszcze trochę światła',
    steps: [
      { id: 'connect', targetId: 'cable' },
      { id: 'switch-on', targetId: 'power', requires: { type: 'flag', id: 'interaction:cable' } },
    ],
    completion: {
      type: 'all',
      conditions: [
        { type: 'flag', id: 'interaction:cable' },
        { type: 'flag', id: 'interaction:power' },
      ],
    },
    rewardFlag: 'camp-lit',
    failForward: 'Dwie czynności można wykonać kolejno solo; w kooperacji gracze dzielą postęp.',
  },
];

export const PILOT_FINALE: StoryCondition = {
  type: 'all',
  conditions: [
    ...PILOT_QUESTS.map((quest): StoryCondition => ({ type: 'quest-complete', id: quest.id })),
    { type: 'flag', id: 'interaction:camp-return' },
  ],
};

/** Checks references and the prerequisite graph before story content reaches an engine. */
export function validatePilotStory(
  map: MapDefinition,
  quests: readonly PilotQuest[] = PILOT_QUESTS,
  finale?: StoryCondition,
): void {
  const targets = new Set(map.interactions.map((target) => target.id));
  const questIds = new Set(quests.map((quest) => quest.id));
  const rewardIds = new Set(quests.map((quest) => quest.rewardFlag));
  if (questIds.size !== quests.length || rewardIds.size !== quests.length)
    throw new Error('Duplicate After quest/reward');
  const dependencies = new Map<string, Set<string>>();
  /** Validates every leaf and records quest edges for cycle detection. */
  function check(condition: StoryCondition, edges: Set<string>): void {
    if (condition.type === 'all' || condition.type === 'any') {
      if (!condition.conditions.length) throw new Error('Empty After condition');
      condition.conditions.forEach((child) => check(child, edges));
    } else if (condition.type === 'quest-complete') {
      if (!questIds.has(condition.id)) throw new Error('Unknown After quest');
      edges.add(condition.id);
    } else if (
      !targets.has(condition.id.replace(/^interaction:/, '')) ||
      !condition.id.startsWith('interaction:')
    ) {
      throw new Error('Unknown After interaction flag');
    }
  }
  for (const quest of quests) {
    if (
      !quest.id ||
      !quest.title.trim() ||
      !quest.rewardFlag ||
      !quest.steps.length ||
      !quest.failForward.trim()
    )
      throw new Error('Incomplete After quest');
    const edges = new Set<string>();
    const stepIds = new Set<string>();
    for (const step of quest.steps) {
      if (!step.id || stepIds.has(step.id) || !targets.has(step.targetId))
        throw new Error('Invalid After quest step');
      stepIds.add(step.id);
      if (step.requires) check(step.requires, edges);
    }
    check(quest.completion, edges);
    dependencies.set(quest.id, edges);
  }
  /** Rejects circular quest dependencies rather than leaving an impossible objective in game. */
  function visit(id: string, path: Set<string>): void {
    if (path.has(id)) throw new Error('Cyclic After quests');
    const next = new Set(path).add(id);
    dependencies.get(id)?.forEach((dependency) => visit(dependency, next));
  }
  questIds.forEach((id) => visit(id, new Set()));
  if (finale) check(finale, new Set());
}
