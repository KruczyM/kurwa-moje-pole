import { validatePilotStory, type PilotQuest, type StoryCondition } from '../data/pilotStory';
import type { MapDefinition } from '../simulation/WorldState';
import { meetsCondition } from './Conditions';

export interface QuestProgress {
  completedQuestIds: string[];
  rewardFlags: string[];
}

/** Owns shared quest progress, not a renderer or a per-player copy of quest rewards. */
export class QuestEngine {
  private readonly quests: readonly PilotQuest[];
  private readonly finale: StoryCondition;
  private readonly targetSteps = new Map<string, PilotQuest['steps'][number][]>();
  private readonly progress: QuestProgress = { completedQuestIds: [], rewardFlags: [] };

  /** Validates graph references and isolates definitions from caller mutations. */
  constructor(map: MapDefinition, quests: readonly PilotQuest[], finale: StoryCondition) {
    validatePilotStory(map, quests, finale);
    this.quests = structuredClone(quests);
    this.finale = structuredClone(finale);
    for (const quest of this.quests) {
      for (const step of quest.steps) {
        const steps = this.targetSteps.get(step.targetId) ?? [];
        steps.push(step);
        this.targetSteps.set(step.targetId, steps);
      }
    }
  }

  /** A shared target is available if any matching quest route permits it. */
  canInteract(targetId: string, flags: readonly string[]): boolean {
    const steps = this.targetSteps.get(targetId);
    return (
      !steps?.length ||
      steps.some(
        (step) => !step.requires || meetsCondition(step.requires, flags, this.progress.completedQuestIds),
      )
    );
  }

  /** Reconciles to a fixed point; reversed definitions work and rewards are emitted only once. */
  update(flags: readonly string[]): string[] {
    const newlyCompleted: string[] = [];
    let changed = true;
    while (changed) {
      changed = false;
      for (const quest of this.quests) {
        if (
          this.progress.completedQuestIds.includes(quest.id) ||
          !meetsCondition(quest.completion, flags, this.progress.completedQuestIds)
        )
          continue;
        this.progress.completedQuestIds.push(quest.id);
        this.progress.rewardFlags.push(quest.rewardFlag);
        newlyCompleted.push(quest.id);
        changed = true;
      }
    }
    return newlyCompleted;
  }

  /** Tests the authored finale only against authoritative interaction flags and quest progress. */
  canFinish(flags: readonly string[]): boolean {
    return meetsCondition(this.finale, flags, this.progress.completedQuestIds);
  }

  /** Returns a detached UI/save snapshot without exposing mutable quest internals. */
  snapshot(): QuestProgress {
    return structuredClone(this.progress);
  }
}
