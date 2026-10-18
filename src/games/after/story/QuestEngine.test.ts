import { describe, expect, it } from 'vitest';
import { createPilotMap } from '../data/pilotMap';
import { PILOT_FINALE, PILOT_QUESTS, type PilotQuest } from '../data/pilotStory';
import { QuestEngine } from './QuestEngine';
import { meetsCondition } from './Conditions';

describe('After quest engine', () => {
  it('executes nested all/any conditions without requiring a particular hero', () => {
    expect(
      meetsCondition(
        {
          type: 'any',
          conditions: [
            { type: 'flag', id: 'missing' },
            {
              type: 'all',
              conditions: [
                { type: 'flag', id: 'found' },
                { type: 'quest-complete', id: 'q1' },
              ],
            },
          ],
        },
        ['found'],
        ['q1'],
      ),
    ).toBe(true);
  });

  it('gates the power switch until cable interaction is committed', () => {
    const engine = new QuestEngine(createPilotMap(), PILOT_QUESTS, PILOT_FINALE);
    expect(engine.canInteract('power', [])).toBe(false);
    expect(engine.canInteract('power', ['interaction:cable'])).toBe(true);
    expect(engine.canInteract('flag', [])).toBe(true);
  });

  it('completes three shared quests once regardless of retries or order', () => {
    const engine = new QuestEngine(createPilotMap(), PILOT_QUESTS, PILOT_FINALE);
    const flags = ['interaction:power', 'interaction:cable', 'interaction:friend', 'interaction:flag'];
    expect(engine.update(flags)).toHaveLength(3);
    expect(engine.update(flags)).toEqual([]);
    expect(engine.snapshot().rewardFlags).toHaveLength(3);
    expect(engine.canFinish(flags)).toBe(false);
    expect(engine.canFinish([...flags, 'interaction:camp-return'])).toBe(true);
    engine.snapshot().completedQuestIds.length = 0;
    expect(engine.snapshot().completedQuestIds).toHaveLength(3);
  });

  it('reconciles reversed dependency order without an extra interaction', () => {
    const first = { ...PILOT_QUESTS[0], id: 'first', rewardFlag: 'first-reward' };
    const second: PilotQuest = {
      ...PILOT_QUESTS[1],
      id: 'second',
      rewardFlag: 'second-reward',
      completion: { type: 'quest-complete', id: 'first' },
    };
    const engine = new QuestEngine(createPilotMap(), [second, first], {
      type: 'quest-complete',
      id: 'second',
    });
    expect(engine.update(['interaction:flag'])).toEqual(['first', 'second']);
    expect(engine.canFinish([])).toBe(true);
  });

  it('rejects an invalid finale and copies external definitions', () => {
    const map = createPilotMap();
    expect(() => new QuestEngine(map, PILOT_QUESTS, { type: 'quest-complete', id: 'unknown' })).toThrow();
    const definitions = structuredClone(PILOT_QUESTS);
    const engine = new QuestEngine(map, definitions, PILOT_FINALE);
    definitions[0].rewardFlag = 'tampered';
    engine.update(['interaction:flag']);
    expect(engine.snapshot().rewardFlags).toEqual(['flag-recovered']);
  });
});
