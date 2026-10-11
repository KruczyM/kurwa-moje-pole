import { describe, expect, it } from 'vitest';
import { createPilotMap } from '../data/pilotMap';
import { PILOT_DIALOGUES, PILOT_DIALOGUE_FLAGS } from '../data/pilotDialogues';
import { PILOT_QUESTS } from '../data/pilotStory';
import { DialogueEngine } from './DialogueEngine';
import type {
  DialogueChoiceCommand,
  DialogueContext,
  DialogueDefinition,
  DialogueEffect,
  DialogueCondition,
} from './DialogueTypes';
import { Relationships } from './Relationships';
import { validateDialogues } from './validateDialogues';

const EMPTY: DialogueContext = { flags: [], completedQuestIds: [] };
const REFERENCES = {
  targetIds: createPilotMap().interactions.map((target) => target.id),
  questIds: PILOT_QUESTS.map((quest) => quest.id),
  flagIds: [
    ...createPilotMap().interactions.map((target) => `interaction:${target.id}`),
    ...PILOT_DIALOGUE_FLAGS,
  ],
};

/** Creates an isolated authored pilot engine for each test. */
function engine(definitions = PILOT_DIALOGUES): DialogueEngine {
  return new DialogueEngine('test', definitions, REFERENCES);
}

/** Builds the command from an owner's current revision, never from internal dialogue definitions. */
function command(
  dialogues: DialogueEngine,
  choiceId: string,
  sequence = 0,
  slotId = 'p1',
  context = EMPTY,
): DialogueChoiceCommand {
  const view = dialogues.view(slotId, context)!;
  return {
    sessionId: 'test',
    slotId,
    conversationId: view.conversationId,
    revision: view.revision,
    sequence,
    choiceId,
  };
}

describe('After dialogue lifecycle and decisions', () => {
  it('opens only authored conversations and never replaces an active one', () => {
    const dialogues = engine();
    expect(dialogues.begin('p1', 'unknown', EMPTY)).toBeUndefined();
    expect(dialogues.begin('p1', 'witness', EMPTY)?.nodeId).toBe('greeting');
    expect(dialogues.begin('p1', 'friend', EMPTY)).toBeUndefined();
    expect(dialogues.view('p1', EMPTY)?.dialogueId).toBe('witness-talk');
  });

  it('uses shared trust to unlock a branch and allows an escapable repeat loop', () => {
    const dialogues = engine();
    dialogues.begin('p1', 'witness', EMPTY);
    expect(dialogues.choose(command(dialogues, 'ask'), EMPTY)?.effectsApplied).toBe(true);
    expect(dialogues.view('p1', EMPTY)?.choices.map((choice) => choice.id)).toContain('shortcut');
    expect(dialogues.snapshot().flags).toEqual(['flag-hint-heard']);
    const old = command(dialogues, 'repeat', 1);
    expect(dialogues.choose(old, EMPTY)?.closed).toBe(false);
    expect(dialogues.choose(old, EMPTY)).toBeUndefined();
    expect(dialogues.choose(command(dialogues, 'thanks', 2), EMPTY)?.closed).toBe(true);
    expect(dialogues.isActive('p1')).toBe(false);
    expect(dialogues.repeatHint('p1')?.nodeId).toBe('hint');
  });

  it('deduplicates effects across participants and repeated contradictory answers', () => {
    const dialogues = engine();
    dialogues.begin('p1', 'friend', EMPTY);
    dialogues.begin('p2', 'friend', EMPTY);
    expect(dialogues.choose(command(dialogues, 'reassure'), EMPTY)?.effectsApplied).toBe(true);
    expect(dialogues.choose(command(dialogues, 'tease', 0, 'p2'), EMPTY)?.effectsApplied).toBe(false);
    dialogues.close('p1');
    dialogues.begin('p1', 'friend', EMPTY);
    expect(dialogues.choose(command(dialogues, 'tease', 1), EMPTY)?.effectsApplied).toBe(false);
    expect(dialogues.snapshot().relations.find((entry) => entry.npcId === 'friend')?.trust).toBe(1);
    expect(dialogues.snapshot().appliedDecisions).toEqual(['friend-talk/greeting']);
  });

  it('rejects wrong session, owner, revision, replay and non-integer sequences', () => {
    const dialogues = engine();
    dialogues.begin('p1', 'witness', EMPTY);
    const valid = command(dialogues, 'ask');
    for (const invalid of [
      { ...valid, sessionId: 'stale' },
      { ...valid, slotId: 'p2' },
      { ...valid, revision: 99 },
      { ...valid, sequence: NaN },
      { ...valid, sequence: -1 },
      { ...valid, sequence: 0.5 },
    ])
      expect(dialogues.choose(invalid, EMPTY)).toBeUndefined();
    expect(dialogues.choose(valid, EMPTY)).toBeDefined();
    expect(dialogues.choose(valid, EMPTY)).toBeUndefined();
  });

  it('validates conditions again when a choice is submitted', () => {
    const dialogues = engine();
    dialogues.begin('p1', 'technician', EMPTY);
    expect(dialogues.view('p1', EMPTY)?.choices.map((choice) => choice.id)).not.toContain('connected');
    expect(dialogues.choose(command(dialogues, 'connected'), EMPTY)).toBeUndefined();
    const context = { ...EMPTY, flags: ['interaction:cable'] };
    expect(dialogues.choose(command(dialogues, 'connected', 1, 'p1', context), context)?.accepted).toBe(true);
    expect(dialogues.view('p1', context)?.nodeId).toBe('ready');
  });

  it('does not consume a decision when simply exiting, and rejects an old reopened conversation', () => {
    const dialogues = engine();
    dialogues.begin('p1', 'friend', EMPTY);
    const stale = command(dialogues, 'reassure');
    expect(dialogues.choose(command(dialogues, 'leave'), EMPTY)?.effectsApplied).toBe(false);
    dialogues.begin('p1', 'friend', EMPTY);
    expect(dialogues.choose({ ...stale, sequence: 1 }, EMPTY)).toBeUndefined();
    expect(dialogues.choose(command(dialogues, 'reassure', 1), EMPTY)?.effectsApplied).toBe(true);
  });

  it('isolates views, history, definitions and shared state from presentation mutations', () => {
    const definitions = structuredClone(PILOT_DIALOGUES);
    const dialogues = engine(definitions);
    definitions[0].nodes[0].text = 'Tampered';
    const view = dialogues.begin('p1', 'witness', EMPTY)!;
    view.text = 'Tampered';
    view.choices.length = 0;
    expect(dialogues.view('p1', EMPTY)?.choices).not.toHaveLength(0);
    dialogues.repeatHint('p1')!.text = 'Tampered';
    expect(dialogues.repeatHint('p1')?.text).not.toBe('Tampered');
    dialogues.choose(command(dialogues, 'ask'), EMPTY);
    dialogues.snapshot().relations[0].trust = 999;
    expect(dialogues.snapshot().relations[0].trust).toBe(1);
    dialogues.closeAll();
    expect(dialogues.view('p1', EMPTY)).toBeUndefined();
    expect(dialogues.snapshot().flags).toEqual(['flag-hint-heard']);
  });
});

describe('After dialogue content validation', () => {
  /** Provides a cloned witness graph for controlled content-corruption tests. */
  function graph(): DialogueDefinition[] {
    return structuredClone([PILOT_DIALOGUES[0]]);
  }

  it('accepts all three authored graphs including loops with exits', () => {
    expect(() => validateDialogues(PILOT_DIALOGUES, REFERENCES)).not.toThrow();
  });

  it('rejects duplicate/unknown IDs and empty text', () => {
    const definitions = graph();
    definitions[0].nodes[0].choices[0].next = 'missing';
    expect(() => validateDialogues(definitions, REFERENCES)).toThrow('choice');
    expect(() => validateDialogues([PILOT_DIALOGUES[0], PILOT_DIALOGUES[0]], REFERENCES)).toThrow();
    const empty = graph();
    empty[0].nodes[0].text = '  ';
    expect(() => validateDialogues(empty, REFERENCES)).toThrow('node');
  });

  it('rejects unreachable nodes and closed loops', () => {
    const unreachable = graph();
    unreachable[0] = {
      ...unreachable[0],
      nodes: [
        ...unreachable[0].nodes,
        { id: 'unused', text: 'Unused', choices: [{ id: 'leave', text: 'Leave', next: null }] },
      ],
    };
    expect(() => validateDialogues(unreachable, REFERENCES)).toThrow('Unreachable');
    const loop = graph();
    loop[0] = {
      ...loop[0],
      nodes: [{ id: 'greeting', text: 'Loop', choices: [{ id: 'repeat', text: 'Again', next: 'greeting' }] }],
    };
    expect(() => validateDialogues(loop, REFERENCES)).toThrow('exit');
  });

  it('rejects an exit available only behind a condition', () => {
    const definitions = graph();
    definitions[0] = {
      ...definitions[0],
      nodes: [
        {
          id: 'greeting',
          text: 'Locked',
          choices: [
            { id: 'leave', text: 'Leave', next: null, requires: { type: 'flag', id: 'flag-hint-heard' } },
          ],
        },
      ],
    };
    expect(() => validateDialogues(definitions, REFERENCES)).toThrow('exit');
  });

  it('rejects unknown condition/effect references and unsafe trust values', () => {
    const definitions = graph();
    const choice = definitions[0].nodes[0].choices[0];
    choice.requires = { type: 'flag', id: 'unknown' };
    expect(() => validateDialogues(definitions, REFERENCES)).toThrow('flag');
    delete choice.requires;
    choice.effects = [{ type: 'trust', npcId: 'witness', delta: Infinity }];
    expect(() => validateDialogues(definitions, REFERENCES)).toThrow('trust');
    choice.effects = [{ type: 'set-flag', id: 'unregistered-flag' }];
    expect(() => validateDialogues(definitions, REFERENCES)).toThrow('flag');
  });

  it('rejects undeclared operations even when their IDs exist in the registry', () => {
    const definitions = graph();
    const choice = definitions[0].nodes[0].choices[0];
    choice.effects = [{ type: 'execute', id: 'flag-hint-heard' } as unknown as DialogueEffect];
    expect(() => validateDialogues(definitions, REFERENCES)).toThrow('operation');
    choice.effects = [];
    choice.requires = { type: 'execute', id: 'recover-flag' } as unknown as DialogueCondition;
    expect(() => validateDialogues(definitions, REFERENCES)).toThrow('operation');
  });
});

describe('After bounded relationships', () => {
  it('clamps at both limits and does not allocate unknown participants', () => {
    const relations = new Relationships(['friend']);
    relations.change('friend', 3);
    relations.change('friend', 3);
    expect(relations.get('friend')).toBe(3);
    for (let i = 0; i < 3; i++) relations.change('friend', -3);
    expect(relations.get('friend')).toBe(-3);
    expect(() => relations.change('unknown', 1)).toThrow();
    expect(() => relations.change('friend', NaN)).toThrow();
    expect(relations.snapshot()).toHaveLength(1);
  });
});
