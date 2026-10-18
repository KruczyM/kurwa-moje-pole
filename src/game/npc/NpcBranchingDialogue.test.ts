import { describe, it, expect, beforeEach } from 'vitest';
import { NpcRelationships } from './NpcRelationships';
import {
  NpcBranchingDialogue,
  DialogueTree,
  isTierSufficient,
  createWieslawDialogueTree,
  createAniaDialogueTree,
  createMatiDialogueTree,
  createJurekDialogueTree,
  createJanDialogueTree,
  createKubaDialogueTree,
} from './NpcBranchingDialogue';

class MockStorage implements Storage {
  private store: Record<string, string> = {};

  get length(): number {
    return Object.keys(this.store).length;
  }

  clear(): void {
    this.store = {};
  }

  getItem(key: string): string | null {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  }

  key(index: number): string | null {
    const keys = Object.keys(this.store);
    return keys[index] ?? null;
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }
}

describe('NpcBranchingDialogue (C2)', () => {
  let mockStorage: MockStorage;
  let relationships: NpcRelationships;
  let dialogueManager: NpcBranchingDialogue;

  beforeEach(() => {
    mockStorage = new MockStorage();
    relationships = new NpcRelationships({ storage: mockStorage, autoSave: true });
    dialogueManager = new NpcBranchingDialogue(relationships, { storage: mockStorage });
  });

  describe('Tier sufficiency helper', () => {
    it('accurately compares relationship tiers hierarchy', () => {
      expect(isTierSufficient('obcy', 'obcy')).toBe(true);
      expect(isTierSufficient('obcy', 'kojarzy')).toBe(false);
      expect(isTierSufficient('kojarzy', 'obcy')).toBe(true);
      expect(isTierSufficient('kojarzy', 'kojarzy')).toBe(true);
      expect(isTierSufficient('znajomy', 'kojarzy')).toBe(true);
      expect(isTierSufficient('znajomy', 'zaufany')).toBe(false);
      expect(isTierSufficient('zaufany', 'zaufany')).toBe(true);
      expect(isTierSufficient('zaufany', 'obcy')).toBe(true);
    });
  });

  describe('Canonical Trees & Validation', () => {
    it('registers default trees for all 6 primary festival NPCs', () => {
      expect(dialogueManager.getDefaultTreeForNpc('woodstock_wieslaw')).toBeDefined();
      expect(dialogueManager.getDefaultTreeForNpc('pokojowy_patrol_ania')).toBeDefined();
      expect(dialogueManager.getDefaultTreeForNpc('flanki_mistrz_mati')).toBeDefined();
      expect(dialogueManager.getDefaultTreeForNpc('jurek')).toBeDefined();
      expect(dialogueManager.getDefaultTreeForNpc('krysznowiec_jan')).toBeDefined();
      expect(dialogueManager.getDefaultTreeForNpc('eko_wolontariusz_kuba')).toBeDefined();
    });

    it('validates that all canonical trees are strictly error-free with no broken references', () => {
      const trees = [
        createWieslawDialogueTree(),
        createAniaDialogueTree(),
        createMatiDialogueTree(),
        createJurekDialogueTree(),
        createJanDialogueTree(),
        createKubaDialogueTree(),
      ];

      for (const tree of trees) {
        const result = dialogueManager.validateTree(tree);
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
        expect(result.deadEndNodeIds).toEqual([]);
        expect(result.unreachableNodeIds).toEqual([]);
      }
    });

    it('detects broken references in invalid dialogue trees', () => {
      const brokenTree: DialogueTree = {
        id: 'broken_tree',
        npcId: 'test_npc',
        title: 'Broken Tree',
        rootNodeId: 'root_node',
        nodes: {
          root_node: {
            id: 'root_node',
            speakerId: 'test_npc',
            text: 'Hello',
            options: [
              {
                label: 'Go to missing node',
                nextNodeId: 'does_not_exist_node',
              },
            ],
          },
        },
      };

      const result = dialogueManager.validateTree(brokenTree);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('does_not_exist_node');
    });

    it('detects missing root nodes', () => {
      const missingRootTree: DialogueTree = {
        id: 'missing_root',
        npcId: 'test_npc',
        title: 'Missing Root',
        rootNodeId: 'invalid_root',
        nodes: {},
      };

      const result = dialogueManager.validateTree(missingRootTree);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('invalid_root'))).toBe(true);
    });

    it('detects dead-end nodes without isEnd flag', () => {
      const deadEndTree: DialogueTree = {
        id: 'dead_end_tree',
        npcId: 'test_npc',
        title: 'Dead End Tree',
        rootNodeId: 'root',
        nodes: {
          root: {
            id: 'root',
            speakerId: 'test_npc',
            text: 'I have no options and no isEnd',
            options: [],
            // missing isEnd: true
          },
        },
      };

      const result = dialogueManager.validateTree(deadEndTree);
      expect(result.deadEndNodeIds).toContain('root');
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('detects unreachable nodes and cycles in dialogue graphs', () => {
      const cyclicWithUnreachable: DialogueTree = {
        id: 'cyclic_tree',
        npcId: 'test_npc',
        title: 'Cyclic Tree',
        rootNodeId: 'node_a',
        nodes: {
          node_a: {
            id: 'node_a',
            speakerId: 'test_npc',
            text: 'Node A',
            options: [{ label: 'To B', nextNodeId: 'node_b' }],
          },
          node_b: {
            id: 'node_b',
            speakerId: 'test_npc',
            text: 'Node B',
            options: [{ label: 'Back to A', nextNodeId: 'node_a' }],
          },
          unreachable_c: {
            id: 'unreachable_c',
            speakerId: 'test_npc',
            text: 'Unreachable Node C',
            options: [],
            isEnd: true,
          },
        },
      };

      const result = dialogueManager.validateTree(cyclicWithUnreachable);
      expect(result.hasCycles).toBe(true);
      expect(result.cyclePaths?.length).toBeGreaterThan(0);
      expect(result.unreachableNodeIds).toContain('unreachable_c');
    });
  });

  describe('Starting and Ending Dialogue', () => {
    it('starts dialogue and initializes active state and history', () => {
      const rootNode = dialogueManager.startDialogue('woodstock_wieslaw');

      expect(rootNode).toBeDefined();
      expect(rootNode?.id).toBe('wieslaw_root');
      expect(dialogueManager.isDialogueActive()).toBe(true);
      expect(dialogueManager.getCurrentSpeaker()).toBe('woodstock_wieslaw');
      expect(dialogueManager.getCurrentNpcId()).toBe('woodstock_wieslaw');

      const history = dialogueManager.getDialogueHistory();
      expect(history.length).toBe(1);
      expect(history[0].nodeId).toBe('wieslaw_root');
    });

    it('returns null and remains inactive when starting dialogue with nonexistent tree or NPC', () => {
      const res = dialogueManager.startDialogue('non_existent_npc');
      expect(res).toBeNull();
      expect(dialogueManager.isDialogueActive()).toBe(false);
      expect(dialogueManager.getCurrentNode()).toBeNull();
    });

    it('ends dialogue safely and clears state', () => {
      dialogueManager.startDialogue('woodstock_wieslaw');
      expect(dialogueManager.isDialogueActive()).toBe(true);

      dialogueManager.endDialogue();
      expect(dialogueManager.isDialogueActive()).toBe(false);
      expect(dialogueManager.getCurrentNode()).toBeNull();
      expect(dialogueManager.getCurrentSpeaker()).toBeNull();
    });
  });

  describe('Conditional Choices and Relationship Progression', () => {
    it('filters out options that do not meet relationship tier requirements', () => {
      // Wiesław starts as 'obcy' (score = 0)
      dialogueManager.startDialogue('woodstock_wieslaw');
      const options = dialogueManager.getAvailableOptions();

      // Options requiring 'kojarzy' or 'zaufany' should NOT be present
      const labels = options.map((o) => o.label);
      expect(labels.some((l) => l.includes('widzę że czymś się martwisz'))).toBe(false);
      expect(labels.some((l) => l.includes('sekret starej gwardii'))).toBe(false);
      // Basic options for strangers SHOULD be present
      expect(labels.some((l) => l.includes('jak tu nie zginąć'))).toBe(true);
      expect(labels.some((l) => l.includes("Jarocin '88"))).toBe(true);
    });

    it('unlocks choices when relationship tier requirement is reached', () => {
      // Raise relationship to 'kojarzy' (score >= 20)
      relationships.recordInteraction('woodstock_wieslaw', 'test', 25, undefined, { force: true });
      expect(relationships.getTier('woodstock_wieslaw')).toBe('kojarzy');

      dialogueManager.startDialogue('woodstock_wieslaw');
      const options = dialogueManager.getAvailableOptions();
      const labels = options.map((o) => o.label);

      // Now the favor intro option is unlocked!
      expect(labels.some((l) => l.includes('widzę że czymś się martwisz'))).toBe(true);
      // But 'zaufany' option is still locked
      expect(labels.some((l) => l.includes('sekret starej gwardii'))).toBe(false);
    });

    it('unlocks choices when a favor is assigned and condition is fulfilled', () => {
      relationships.recordInteraction('woodstock_wieslaw', 'test', 25, undefined, { force: true });
      dialogueManager.startDialogue('woodstock_wieslaw');

      // Before favor assignment, option to return bandana is NOT available
      let options = dialogueManager.getAvailableOptions();
      expect(options.some((o) => o.label.includes('Mam twoją czerwoną bandanę'))).toBe(false);

      // Assign favor
      dialogueManager.assignFavor('wieslaw_znajdz_bandane');

      // Now option to return bandana IS available
      options = dialogueManager.getAvailableOptions();
      expect(options.some((o) => o.label.includes('Mam twoją czerwoną bandanę'))).toBe(true);
    });
  });

  describe('Traversal and Action Execution', () => {
    it('executes actions, awards scores, learns topics and transitions nodes on option selection', () => {
      dialogueManager.startDialogue('woodstock_wieslaw');

      // Option 0: 'Cześć! Pierwszy raz jestem na festiwalu, jak tu nie zginąć?' (rewardScore: 10, learnTopic: 'glany')
      const nextNode = dialogueManager.selectOption(0);

      expect(nextNode).toBeDefined();
      expect(nextNode?.id).toBe('wieslaw_porady');
      expect(relationships.getScore('woodstock_wieslaw')).toBe(10);
      expect(relationships.hasTopic('woodstock_wieslaw', 'glany')).toBe(true);

      // History should track choices
      const history = dialogueManager.getDialogueHistory();
      expect(history.length).toBe(2);
      expect(history[0].selectedOptionLabel).toContain('jak tu nie zginąć');
    });

    it('returns safely from hub-and-spoke dialogue loops without infinite recursion', () => {
      dialogueManager.startDialogue('woodstock_wieslaw');

      // Go to advice
      dialogueManager.selectOption(0);
      expect(dialogueManager.getCurrentNode()?.id).toBe('wieslaw_porady');

      // Return to root
      dialogueManager.selectOption(0);
      expect(dialogueManager.getCurrentNode()?.id).toBe('wieslaw_root');

      // Go to Jarocin
      dialogueManager.selectOption(1);
      expect(dialogueManager.getCurrentNode()?.id).toBe('wieslaw_jarocin');

      // Return to root
      dialogueManager.selectOption(0);
      expect(dialogueManager.getCurrentNode()?.id).toBe('wieslaw_root');

      expect(dialogueManager.isDialogueActive()).toBe(true);
    });

    it('terminates dialogue when selecting an option with isEnd flag', () => {
      dialogueManager.startDialogue('woodstock_wieslaw');
      const options = dialogueManager.getAvailableOptions();
      const exitIndex = options.findIndex((o) => o.label.includes('lecę pod scenę'));

      const result = dialogueManager.selectOption(exitIndex);
      expect(result).toBeNull();
      expect(dialogueManager.isDialogueActive()).toBe(false);
    });

    it('allows player to decline favor without penalty or blocking the game', () => {
      relationships.recordInteraction('woodstock_wieslaw', 'test', 25, undefined, { force: true });
      dialogueManager.startDialogue('woodstock_wieslaw');

      // Choose "widzę że czymś się martwisz"
      const available = dialogueManager.getAvailableOptions();
      const worryIndex = available.findIndex((o) => o.label.includes('czymś się martwisz'));
      dialogueManager.selectOption(worryIndex);

      expect(dialogueManager.getCurrentNode()?.id).toBe('wieslaw_zguba_intro');

      // Choose decline option: "nie dam rady"
      const declineOptions = dialogueManager.getAvailableOptions();
      const declineIndex = declineOptions.findIndex((o) => o.label.includes('nie dam rady'));
      dialogueManager.selectOption(declineIndex);

      expect(dialogueManager.getCurrentNode()?.id).toBe('wieslaw_zguba_odmowa');
      // Score is unchanged, no penalty
      expect(relationships.getScore('woodstock_wieslaw')).toBe(25);

      // Return to root
      dialogueManager.selectOption(0);
      expect(dialogueManager.getCurrentNode()?.id).toBe('wieslaw_root');
      expect(dialogueManager.isDialogueActive()).toBe(true);
    });
  });

  describe('Full Story Arc & Favor Completion', () => {
    it('plays through the complete Wiesław quest arc from stranger to trusted friend', () => {
      // 1. Initial State: Stranger
      expect(relationships.getTier('woodstock_wieslaw')).toBe('obcy');
      dialogueManager.startDialogue('woodstock_wieslaw');

      // 2. Chat about tips (+10 score)
      dialogueManager.selectOption(0); // wieslaw_porady
      dialogueManager.selectOption(0); // return to root

      // 3. Chat about Jarocin (+15 score -> total 25 -> tier 'kojarzy')
      dialogueManager.selectOption(1); // wieslaw_jarocin
      dialogueManager.selectOption(0); // return to root

      expect(relationships.getScore('woodstock_wieslaw')).toBe(25);
      expect(relationships.getTier('woodstock_wieslaw')).toBe('kojarzy');

      // 4. Inquire about worry (now unlocked!)
      const opts1 = dialogueManager.getAvailableOptions();
      const worryIdx = opts1.findIndex((o) => o.label.includes('czymś się martwisz'));
      dialogueManager.selectOption(worryIdx);

      // 5. Accept quest (+10 score -> total 35)
      const opts2 = dialogueManager.getAvailableOptions();
      const acceptIdx = opts2.findIndex((o) => o.label.includes('Pomogę ci jej poszukać'));
      dialogueManager.selectOption(acceptIdx);
      expect(dialogueManager.isFavorAssigned('wieslaw_znajdz_bandane')).toBe(true);

      // Return to root
      dialogueManager.selectOption(0);

      // 6. Return bandana (+35 score -> total 70 -> tier 'znajomy')
      const opts3 = dialogueManager.getAvailableOptions();
      const returnIdx = opts3.findIndex((o) => o.label.includes('Mam twoją czerwoną bandanę'));
      expect(returnIdx).toBeGreaterThanOrEqual(0);
      dialogueManager.selectOption(returnIdx);

      expect(dialogueManager.getCurrentNode()?.id).toBe('wieslaw_nagroda_bandana');
      // Confirm reward
      dialogueManager.selectOption(0);

      expect(relationships.hasCompletedFavor('woodstock_wieslaw', 'wieslaw_znajdz_bandane')).toBe(true);
      expect(relationships.getScore('woodstock_wieslaw')).toBe(70);
      expect(relationships.getTier('woodstock_wieslaw')).toBe('znajomy');
      expect(dialogueManager.hasClue('wieslaw_sekretne_przejscie')).toBe(true);

      // 7. Verify favor cannot be completed a second time for duplicate reward
      const optsAfter = dialogueManager.getAvailableOptions();
      expect(optsAfter.some((o) => o.label.includes('Mam twoją czerwoną bandanę'))).toBe(false);
    });
  });

  describe('Dialogue State Persistence', () => {
    it('persists assigned favors and unlocked clues to storage and restores them', () => {
      dialogueManager.assignFavor('quest_flagi');
      dialogueManager.unlockClue('wskazowka_kostrzyn');

      const restored = new NpcBranchingDialogue(relationships, { storage: mockStorage });
      expect(restored.isFavorAssigned('quest_flagi')).toBe(true);
      expect(restored.hasClue('wskazowka_kostrzyn')).toBe(true);
      expect(restored.isFavorAssigned('other_quest')).toBe(false);
    });

    it('resets dialogue state and cleans storage', () => {
      dialogueManager.assignFavor('quest_1');
      dialogueManager.unlockClue('clue_1');

      dialogueManager.resetState();
      expect(dialogueManager.getAssignedFavors()).toEqual([]);
      expect(dialogueManager.getUnlockedClues()).toEqual([]);
    });
  });
});
