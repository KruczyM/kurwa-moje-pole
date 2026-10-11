import type { StoryCondition } from '../data/pilotStory';

export type DialogueCondition = StoryCondition | { type: 'trust-at-least'; npcId: string; value: number };
export type DialogueEffect =
  { type: 'trust'; npcId: string; delta: number } | { type: 'set-flag'; id: string };

export interface DialogueChoice {
  id: string;
  text: string;
  next: string | null;
  requires?: DialogueCondition;
  effects?: readonly DialogueEffect[];
}

export interface DialogueNode {
  id: string;
  text: string;
  choices: readonly DialogueChoice[];
}

export interface DialogueDefinition {
  id: string;
  npcId: string;
  speaker: string;
  targetId: string;
  entry: string;
  nodes: readonly DialogueNode[];
}

export interface DialogueContext {
  flags: readonly string[];
  completedQuestIds: readonly string[];
}

export interface DialogueView {
  conversationId: number;
  revision: number;
  slotId: string;
  dialogueId: string;
  npcId: string;
  speaker: string;
  nodeId: string;
  text: string;
  choices: { id: string; text: string }[];
  canClose: true;
}

export interface DialogueChoiceCommand {
  sessionId: string;
  slotId: string;
  conversationId: number;
  revision: number;
  sequence: number;
  choiceId: string;
}

export type DialogueHint = Pick<DialogueView, 'dialogueId' | 'speaker' | 'nodeId' | 'text'>;
