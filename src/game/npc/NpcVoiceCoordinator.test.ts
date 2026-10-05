import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { NpcVoiceCoordinator } from './NpcVoiceCoordinator';
import { NpcManager, Npc } from './NpcManager';
import { geminiNpcService } from './GeminiNpcService';
import { NpcRelationships } from './NpcRelationships';
import { NpcBranchingDialogue } from './NpcBranchingDialogue';
import { PatrolQuiz } from '../interactions/PatrolQuiz';

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
    vi.stubEnv('VITE_GEMINI_API_KEY', '');
    vi.stubEnv('VITE_ELEVENLABS_API_KEY', '');

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
    vi.unstubAllEnvs();
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
    vi.spyOn(geminiNpcService, 'generateResponse').mockResolvedValueOnce({
      text: 'ZAMKNIJ SIĘ!',
      source: 'gemini',
    });
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

  it('displays guidance and prompts Gemini settings when speaking without an API key', async () => {
    const dialogText = { textContent: '', innerHTML: '' } as unknown as HTMLElement;
    const configPanel = {
      removeAttribute: vi.fn(),
      setAttribute: vi.fn(),
      style: { display: 'none' },
    } as unknown as HTMLElement;

    const coordinator = new NpcVoiceCoordinator(npcManagerMock, {
      textElement: dialogText,
      geminiConfigElement: configPanel,
    });

    coordinator.startConversation('Pień aka Peposz');
    await coordinator.submitSpeechInput('Siema Peposz!');

    expect(dialogText.innerHTML).toContain('Do rozmowy z mieszkańcami obozu wymagany jest klucz Gemini API');
    expect(configPanel.removeAttribute).toHaveBeenCalledWith('hidden');
    expect(configPanel.style.display).toBe('block');

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

  it('selects female voice and applies higher pitch for female characters', () => {
    let capturedUtterance: any;
    const mockVoices = [
      { name: 'Microsoft Adam - Polish', lang: 'pl-PL', voiceURI: 'adam' },
      { name: 'Microsoft Paulina - Polish', lang: 'pl-PL', voiceURI: 'paulina' },
    ];

    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      class MockUtterance {
        text: string;
        lang = '';
        pitch = 1.0;
        rate = 1.0;
        volume = 1.0;
        voice: any;
        onstart: any;
        onend: any;
        onerror: any;
        constructor(text: string) {
          this.text = text;
          // eslint-disable-next-line @typescript-eslint/no-this-alias
          capturedUtterance = this;
        }
      },
    );

    vi.stubGlobal('speechSynthesis', {
      speak: vi.fn(),
      cancel: vi.fn(),
      resume: vi.fn(),
      getVoices: () => mockVoices,
    });

    const coordinator = new NpcVoiceCoordinator(npcManagerMock);

    // Speak as female (Korba):
    coordinator.speakText('Hejka!', { pitch: 1.3, rate: 1.1, volume: 1.0, gender: 'female' });
    expect(capturedUtterance).toBeDefined();
    expect(capturedUtterance.voice?.name).toBe('Microsoft Paulina - Polish');
    expect(capturedUtterance.pitch).toBeGreaterThanOrEqual(1.24);

    // Speak as male (Pień):
    coordinator.speakText('Siemanko!', { pitch: 0.85, rate: 0.95, volume: 1.0, gender: 'male' });
    expect(capturedUtterance.voice?.name).toBe('Microsoft Adam - Polish');
    expect(capturedUtterance.pitch).toBeLessThanOrEqual(1.05);

    coordinator.dispose();
  });

  it('allows saving and clearing ElevenLabs API key via UI elements', () => {
    const inputElement = { value: 'sk_test_elevenlabs_123456789' } as HTMLInputElement;
    const saveButton = { onclick: null } as unknown as HTMLButtonElement;
    const clearButton = { onclick: null } as unknown as HTMLButtonElement;
    const statusElement = { textContent: '' } as HTMLElement;
    const geminiButton = {
      classList: { add: vi.fn(), remove: vi.fn() },
      title: '',
    } as unknown as HTMLButtonElement;

    const coordinator = new NpcVoiceCoordinator(npcManagerMock, {
      elevenLabsInputElement: inputElement,
      elevenLabsSaveButton: saveButton,
      elevenLabsClearButton: clearButton,
      elevenLabsStatusElement: statusElement,
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

  it('falls back to Web Speech when ElevenLabs synthesis fails or quota is exceeded', async () => {
    vi.stubEnv('VITE_ELEVENLABS_API_KEY', 'sk_test_mock');
    const coordinator = new NpcVoiceCoordinator(npcManagerMock);
    const webSpeechSpy = vi.spyOn(coordinator, 'speakWebSpeech');

    // Mock ElevenLabs to return 429 quota exceeded:
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: () => Promise.resolve('{"detail": {"status": "quota_exceeded"}}'),
      }),
    );

    coordinator.speakText('Siemanko!', { pitch: 1.0, rate: 1.0, volume: 1.0, gender: 'male' });

    // Oczekiwanie na przejście przez asynchroniczny potok fallbacku:
    await new Promise((r) => setTimeout(r, 20));

    expect(webSpeechSpy).toHaveBeenCalledWith('Siemanko!', expect.any(Object), undefined);

    coordinator.dispose();
  });

  it('presents branching dialogue choices when interacting with registered NPC', () => {
    const relationships = new NpcRelationships();
    const branching = new NpcBranchingDialogue(relationships);

    const choicesEl = {
      innerHTML: '',
      appendChild: vi.fn(),
    } as any;

    const coordinator = new NpcVoiceCoordinator(npcManagerMock, {
      choicesContainer: choicesEl,
      branchingDialogue: branching,
    });

    coordinator.startConversation('Ania z Patrolu');
    expect(choicesEl.appendChild).toHaveBeenCalled();

    coordinator.dispose();
  });

  it('initiates and answers Patrol Quiz in dialogue', () => {
    const relationships = new NpcRelationships();
    const branching = new NpcBranchingDialogue(relationships);
    const quiz = new PatrolQuiz();

    const appendedButtons: any[] = [];
    const choicesEl = {
      innerHTML: '',
      appendChild: (btn: any) => appendedButtons.push(btn),
    } as any;

    const coordinator = new NpcVoiceCoordinator(npcManagerMock, {
      choicesContainer: choicesEl,
      branchingDialogue: branching,
      patrolQuiz: quiz,
    });

    coordinator.startConversation('Ania z Patrolu');
    // Find button with Quiz
    const quizBtn = appendedButtons.find((btn) => btn.textContent.includes('Quiz'));
    expect(quizBtn).toBeDefined();

    // Trigger quiz
    appendedButtons.length = 0;
    quizBtn.onclick();
    expect(quiz.getProgress().currentQuestionIndex).toBe(0);

    coordinator.dispose();
  });
});
