import { meetsCondition } from './Conditions';
import type {
  DialogueChoiceCommand,
  DialogueContext,
  DialogueDefinition,
  DialogueView,
  DialogueHint,
} from './DialogueTypes';
import { Relationships } from './Relationships';
import { validateDialogues } from './validateDialogues';

interface Conversation {
  id: number;
  revision: number;
  definition: DialogueDefinition;
  nodeId: string;
}

/** Owns per-slot conversations and shared, idempotent story decisions, without any UI or update loop. */
export class DialogueEngine {
  private readonly byTarget = new Map<string, DialogueDefinition>();
  private readonly active = new Map<string, Conversation>();
  private readonly lastHint = new Map<string, DialogueHint>();
  private readonly sequences = new Map<string, number>();
  private readonly decisions = new Set<string>();
  private readonly flags = new Set<string>();
  private readonly relationships: Relationships;
  private nextConversationId = 1;

  /** Validates and clones content; the session supplies stable participant IDs at the campaign boundary. */
  constructor(
    private readonly sessionId: string,
    definitions: readonly DialogueDefinition[],
    references: Parameters<typeof validateDialogues>[1],
  ) {
    validateDialogues(definitions, references);
    for (const definition of structuredClone(definitions)) this.byTarget.set(definition.targetId, definition);
    this.relationships = new Relationships([...new Set(definitions.map((definition) => definition.npcId))]);
  }

  /** Reports whether this authored interaction has an associated dialogue. */
  hasTarget(targetId: string): boolean {
    return this.byTarget.has(targetId);
  }

  /** Prevents a participant from moving or opening a second conversation while already talking. */
  isActive(slotId: string): boolean {
    return this.active.has(slotId);
  }

  /** Opens after the campaign has checked participant, distance, line of sight and command freshness. */
  begin(slotId: string, targetId: string, context: DialogueContext): DialogueView | undefined {
    const definition = this.byTarget.get(targetId);
    if (!definition || this.active.has(slotId)) return;
    this.active.set(slotId, {
      id: this.nextConversationId++,
      revision: 0,
      definition,
      nodeId: definition.entry,
    });
    return this.view(slotId, context);
  }

  /** Filters choices against authoritative flags/quests and current shared trust, never client hints. */
  private allowed(
    choice: DialogueDefinition['nodes'][number]['choices'][number],
    context: DialogueContext,
  ): boolean {
    if (!choice.requires) return true;
    if (choice.requires.type === 'trust-at-least')
      return this.relationships.get(choice.requires.npcId) >= choice.requires.value;
    return meetsCondition(choice.requires, [...context.flags, ...this.flags], context.completedQuestIds);
  }

  /** Produces a detached display-only view; internal transitions and effects are never sent as choices. */
  view(slotId: string, context: DialogueContext): DialogueView | undefined {
    const conversation = this.active.get(slotId);
    if (!conversation) return;
    const { definition } = conversation;
    const node = definition.nodes.find((entry) => entry.id === conversation.nodeId)!;
    const view: DialogueView = {
      conversationId: conversation.id,
      revision: conversation.revision,
      slotId,
      dialogueId: definition.id,
      npcId: definition.npcId,
      speaker: definition.speaker,
      nodeId: node.id,
      text: node.text,
      choices: node.choices
        .filter((choice) => this.allowed(choice, context))
        .map((choice) => ({ id: choice.id, text: choice.text })),
      canClose: true,
    };
    this.lastHint.set(slotId, {
      dialogueId: view.dialogueId,
      speaker: view.speaker,
      nodeId: view.nodeId,
      text: view.text,
    });
    return view;
  }

  /** Applies one owner choice; stale conversations/revisions/retries cannot duplicate shared decisions. */
  choose(
    command: DialogueChoiceCommand,
    context: DialogueContext,
  ): { accepted: true; effectsApplied: boolean; closed: boolean } | undefined {
    const conversation = this.active.get(command.slotId);
    if (
      !conversation ||
      command.sessionId !== this.sessionId ||
      command.conversationId !== conversation.id ||
      command.revision !== conversation.revision ||
      !Number.isSafeInteger(command.sequence) ||
      command.sequence < 0 ||
      command.sequence <= (this.sequences.get(command.slotId) ?? -1)
    )
      return;
    this.sequences.set(command.slotId, command.sequence);
    const node = conversation.definition.nodes.find((entry) => entry.id === conversation.nodeId)!;
    const choice = node.choices.find((entry) => entry.id === command.choiceId);
    if (!choice || !this.allowed(choice, context)) return;
    const decisionId = `${conversation.definition.id}/${node.id}`;
    const effectsApplied = !!choice.effects?.length && !this.decisions.has(decisionId);
    if (effectsApplied) {
      for (const effect of choice.effects!) {
        if (effect.type === 'trust') this.relationships.change(effect.npcId, effect.delta);
        else this.flags.add(effect.id);
      }
      this.decisions.add(decisionId);
    }
    if (choice.next === null) this.close(command.slotId);
    else {
      conversation.nodeId = choice.next;
      conversation.revision++;
      this.view(command.slotId, context);
    }
    return { accepted: true, effectsApplied, closed: choice.next === null };
  }

  /** Escape/back closes only this owner's conversation, without granting or rolling back progress. */
  close(slotId: string): boolean {
    return this.active.delete(slotId);
  }

  /** Ends transient conversations on finale/session teardown; persistent story decisions remain. */
  closeAll(): void {
    this.active.clear();
  }

  /** Repeats the last viewed hint as read-only journal data, without reopening or replaying effects. */
  repeatHint(slotId: string): DialogueHint | undefined {
    const hint = this.lastHint.get(slotId);
    return hint ? structuredClone(hint) : undefined;
  }

  /** Returns shared serializable progress; active conversations are queried by owner separately. */
  snapshot() {
    return {
      flags: [...this.flags],
      relations: this.relationships.snapshot(),
      appliedDecisions: [...this.decisions],
    };
  }
}
