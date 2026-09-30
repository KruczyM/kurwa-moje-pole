import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { NpcVoiceCoordinator } from './NpcVoiceCoordinator';
import { NpcManager, Npc } from './NpcManager';

describe('NpcVoiceCoordinator', () => {
  let npcManagerMock: NpcManager;
  let testNpc: Npc;
  let mockStorage: Record<string, string>;

  beforeEach(() => {
    mockStorage = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, val: string) => {
        mockStorage[key] = val;
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
    });

    testNpc = {
      root: new THREE.Group(),
      name: 'Pień aka Peposz',
      line: ['To naprawdę moje pole!'],
      phase: 0,
      target: new THREE.Vector3(5, 0, 5),
      wait: 0,
      returning: false,
      stationary: false,
      speed: 1.5,
      velocity: new THREE.Vector3(1, 0, 0),
      steeringDirection: new THREE.Vector3(1, 0, 0),
      waypoints: [new THREE.Vector3(5, 0, 5)],
      behavior: {
        state: 'wander',
        travelling: true,
      } as any,
      watchdog: {
        resetPosition: vi.fn(),
      } as any,
      inConversation: false,
      passageWalker: false,
      passageDirection: 1,
      activityCooldown: 0,
      isCampMember: true,
      animLodAccumulator: 0,
    };
    testNpc.root.position.set(0, 0, 0);

    npcManagerMock = {
      npcs: [testNpc],
      pauseNpcForConversation: vi.fn((name: string, facePos?: THREE.Vector3) => {
        if (name === testNpc.name) {
          testNpc.inConversation = true;
          testNpc.stationary = true;
          testNpc.speed = 0;
          testNpc.velocity.set(0, 0, 0);
          testNpc.waypoints.length = 0;
          if (facePos) {
            const dx = facePos.x - testNpc.root.position.x;
            const dz = facePos.z - testNpc.root.position.z;
            testNpc.root.rotation.y = Math.atan2(dx, dz);
          }
          return testNpc;
        }
        return undefined;
      }),
      resumeNpcAfterConversation: vi.fn((name: string, waitSec = 2.0) => {
        if (name === testNpc.name) {
          testNpc.inConversation = false;
          testNpc.stationary = false;
          testNpc.wait = waitSec;
          testNpc.speed = 0;
        }
      }),
    } as unknown as NpcManager;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('pauses NPC locomotion and rotates NPC to face the player when starting conversation', () => {
    const dialogName = { textContent: '' } as unknown as HTMLElement;
    const dialogText = { textContent: '', innerHTML: '' } as unknown as HTMLElement;

    const coordinator = new NpcVoiceCoordinator(npcManagerMock, {
      nameElement: dialogName,
      textElement: dialogText,
    });

    const playerPos = new THREE.Vector3(0, 0, 10); // Player is in positive Z direction
    coordinator.startConversation('Pień aka Peposz', playerPos);

    expect(npcManagerMock.pauseNpcForConversation).toHaveBeenCalledWith('Pień aka Peposz', playerPos);
    expect(testNpc.inConversation).toBe(true);
    expect(testNpc.stationary).toBe(true);
    expect(testNpc.speed).toBe(0);
    expect(testNpc.waypoints.length).toBe(0);
    // When player is at (0, 0, 10) relative to (0, 0, 0), atan2(0, 10) is 0:
    expect(testNpc.root.rotation.y).toBeCloseTo(0, 2);

    expect(dialogName.textContent).toContain('Peposz');
    expect(dialogText.textContent).toContain('To naprawdę moje pole');

    coordinator.dispose();
  });

  it('resumes NPC locomotion when ending conversation', () => {
    const coordinator = new NpcVoiceCoordinator(npcManagerMock);

    coordinator.startConversation('Pień aka Peposz');
    expect(testNpc.inConversation).toBe(true);

    coordinator.endConversation();

    expect(npcManagerMock.resumeNpcAfterConversation).toHaveBeenCalledWith('Pień aka Peposz', 2.0);
    expect(testNpc.inConversation).toBe(false);
    expect(testNpc.wait).toBe(2.0);

    coordinator.dispose();
  });

  it('submits text input and generates an AI response in dialogue', async () => {
    const dialogText = { textContent: '', innerHTML: '' } as unknown as HTMLElement;
    const coordinator = new NpcVoiceCoordinator(npcManagerMock, {
      textElement: dialogText,
    });

    coordinator.startConversation('Pień aka Peposz');
    await coordinator.submitSpeechInput('Zaraz będzie ciemno!');

    expect(dialogText.innerHTML).toContain('Ty:');
    expect(dialogText.innerHTML).toContain('Zaraz będzie ciemno!');
    expect(dialogText.innerHTML).toContain('ZAMKNIJ SIĘ');

    coordinator.dispose();
  });

  it('allows saving and clearing Gemini API key via UI elements', () => {
    const inputElement = { value: 'AIzaSyTestKeyFromUI123456789' } as HTMLInputElement;
    const saveButton = { onclick: null } as unknown as HTMLButtonElement;
    const clearButton = { onclick: null } as unknown as HTMLButtonElement;
    const statusElement = { textContent: '' } as HTMLElement;
    const geminiButton = {
      classList: { add: vi.fn(), remove: vi.fn() },
      title: '',
    } as unknown as HTMLButtonElement;

    const coordinator = new NpcVoiceCoordinator(npcManagerMock, {
      geminiInputElement: inputElement,
      geminiSaveButton: saveButton,
      geminiClearButton: clearButton,
      geminiStatusElement: statusElement,
      geminiButton,
    });

    // Test save:
    expect(typeof saveButton.onclick).toBe('function');
    saveButton.onclick!({} as any);
    expect(statusElement.textContent).toContain('Klucz zapisany');
    expect(inputElement.value).toContain('...'); // Masked

    // Test clear:
    expect(typeof clearButton.onclick).toBe('function');
    clearButton.onclick!({} as any);
    expect(statusElement.textContent).toContain('Klucz usunięty');
    expect(inputElement.value).toBe('');

    coordinator.dispose();
  });

  it('invokes speakText on replayLastSpeech when a line was previously spoken', () => {
    const coordinator = new NpcVoiceCoordinator(npcManagerMock);
    const speakSpy = vi.spyOn(coordinator, 'speakText');

    coordinator.startConversation('Pień aka Peposz');
    expect(speakSpy).toHaveBeenCalledTimes(1);

    coordinator.replayLastSpeech();
    expect(speakSpy).toHaveBeenCalledTimes(2);

    coordinator.dispose();
  });
});
