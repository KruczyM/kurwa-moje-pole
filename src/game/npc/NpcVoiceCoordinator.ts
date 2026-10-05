import * as THREE from 'three';
import { NpcManager } from './NpcManager';
import { NpcAiAgent, type NpcVoiceSettings, type NpcDialogueContext } from './NpcAiAgent';
import { geminiNpcService } from './GeminiNpcService';
import { elevenLabsNpcService } from './ElevenLabsNpcService';
import { NpcBranchingDialogue } from './NpcBranchingDialogue';
import { PatrolQuiz } from '../interactions/PatrolQuiz';

export function cleanTextForSpeech(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*[^*]+\*/g, '')
    .replace(/[_~`#]/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
      '',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Deklaracje typów Web Speech API dla TypeScript:
interface SpeechRecognitionEventLike extends Event {
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: SpeechRecognitionLike, ev: Event) => void) | null;
  onend: ((this: SpeechRecognitionLike, ev: Event) => void) | null;
  onerror: ((this: SpeechRecognitionLike, ev: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((this: SpeechRecognitionLike, ev: SpeechRecognitionEventLike) => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

export type VoiceCoordinatorStatus =
  'idle' | 'listening' | 'processing' | 'speaking' | 'unsupported' | 'error';

export interface NpcVoiceCoordinatorOptions {
  dialogRoot?: HTMLElement;
  nameElement?: HTMLElement;
  textElement?: HTMLElement;
  voiceStatusElement?: HTMLElement;
  textInputElement?: HTMLInputElement;
  sendButton?: HTMLButtonElement;
  micButton?: HTMLButtonElement;
  replayButton?: HTMLButtonElement;
  geminiButton?: HTMLButtonElement;
  geminiConfigElement?: HTMLElement;
  geminiInputElement?: HTMLInputElement;
  geminiSaveButton?: HTMLButtonElement;
  geminiClearButton?: HTMLButtonElement;
  geminiCloseButton?: HTMLButtonElement;
  geminiStatusElement?: HTMLElement;
  elevenLabsInputElement?: HTMLInputElement;
  elevenLabsSaveButton?: HTMLButtonElement;
  elevenLabsClearButton?: HTMLButtonElement;
  elevenLabsStatusElement?: HTMLElement;
  choicesContainer?: HTMLElement;
  branchingDialogue?: NpcBranchingDialogue;
  patrolQuiz?: PatrolQuiz;
  onStatusChange?: (status: VoiceCoordinatorStatus, message?: string) => void;
}

export class NpcVoiceCoordinator {
  private currentNpcName?: string;
  private recognition?: SpeechRecognitionLike;
  private currentUtterance?: SpeechSynthesisUtterance;
  private status: VoiceCoordinatorStatus = 'idle';
  private listeningActive = false;
  private disposed = false;
  private isQuizActive = false;

  private voices: SpeechSynthesisVoice[] = [];
  private readonly activeUtterances = new Set<SpeechSynthesisUtterance>();
  private lastSpokenText = '';
  private lastSpokenVoiceSettings: NpcVoiceSettings = { pitch: 1, rate: 1, volume: 1 };
  private ttsEnabled = true;
  private history: Array<{ sender: string; text: string; isPlayer: boolean }> = [];

  private readonly dialogRoot?: HTMLElement;
  private readonly nameElement?: HTMLElement;
  private readonly textElement?: HTMLElement;
  private readonly voiceStatusElement?: HTMLElement;
  private readonly textInputElement?: HTMLInputElement;
  private readonly sendButton?: HTMLButtonElement;
  private readonly micButton?: HTMLButtonElement;
  private readonly replayButton?: HTMLButtonElement;
  private readonly geminiButton?: HTMLButtonElement;
  private readonly geminiConfigElement?: HTMLElement;
  private readonly geminiInputElement?: HTMLInputElement;
  private readonly geminiSaveButton?: HTMLButtonElement;
  private readonly geminiClearButton?: HTMLButtonElement;
  private readonly geminiCloseButton?: HTMLButtonElement;
  private readonly geminiStatusElement?: HTMLElement;
  private readonly elevenLabsInputElement?: HTMLInputElement;
  private readonly elevenLabsSaveButton?: HTMLButtonElement;
  private readonly elevenLabsClearButton?: HTMLButtonElement;
  private readonly elevenLabsStatusElement?: HTMLElement;
  private readonly choicesContainer?: HTMLElement;
  private readonly branchingDialogue?: NpcBranchingDialogue;
  private readonly patrolQuiz?: PatrolQuiz;
  private readonly onStatusChange?: (status: VoiceCoordinatorStatus, message?: string) => void;

  constructor(
    private readonly npcManager: NpcManager,
    options: NpcVoiceCoordinatorOptions = {},
  ) {
    this.dialogRoot = options.dialogRoot;
    this.nameElement = options.nameElement;
    this.textElement = options.textElement;
    this.voiceStatusElement = options.voiceStatusElement;
    this.textInputElement = options.textInputElement;
    this.sendButton = options.sendButton;
    this.micButton = options.micButton;
    this.replayButton = options.replayButton;
    this.geminiButton = options.geminiButton;
    this.geminiConfigElement = options.geminiConfigElement;
    this.geminiInputElement = options.geminiInputElement;
    this.geminiSaveButton = options.geminiSaveButton;
    this.geminiClearButton = options.geminiClearButton;
    this.geminiCloseButton = options.geminiCloseButton;
    this.geminiStatusElement = options.geminiStatusElement;
    this.elevenLabsInputElement = options.elevenLabsInputElement;
    this.elevenLabsSaveButton = options.elevenLabsSaveButton;
    this.elevenLabsClearButton = options.elevenLabsClearButton;
    this.elevenLabsStatusElement = options.elevenLabsStatusElement;
    this.choicesContainer = options.choicesContainer;
    this.branchingDialogue = options.branchingDialogue;
    this.patrolQuiz = options.patrolQuiz;
    this.onStatusChange = options.onStatusChange;

    this.initSpeechSynthesis();
    this.initSpeechRecognition();
    this.bindUiEvents();
  }

  private getSpeechSynthesis(): SpeechSynthesis | undefined {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      return window.speechSynthesis;
    }
    if (typeof globalThis !== 'undefined' && (globalThis as any).speechSynthesis) {
      return (globalThis as any).speechSynthesis;
    }
    return undefined;
  }

  private getSpeechSynthesisUtterance(): (new (text?: string) => SpeechSynthesisUtterance) | undefined {
    if (typeof window !== 'undefined' && (window as any).SpeechSynthesisUtterance) {
      return (window as any).SpeechSynthesisUtterance;
    }
    if (typeof globalThis !== 'undefined' && (globalThis as any).SpeechSynthesisUtterance) {
      return (globalThis as any).SpeechSynthesisUtterance;
    }
    return undefined;
  }

  private initSpeechSynthesis(): void {
    const synth = this.getSpeechSynthesis();
    if (!synth) return;
    const loadVoices = () => {
      this.voices = synth.getVoices();
    };
    loadVoices();
    synth.onvoiceschanged = loadVoices;
  }

  private initSpeechRecognition(): void {
    if (typeof window === 'undefined') return;

    const SpeechRecConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecConstructor) {
      this.setStatus('unsupported', 'Brak wsparcia rozpoznawania mowy w tej przeglądarce.');
      return;
    }

    try {
      this.recognition = new SpeechRecConstructor();
      this.recognition.lang = 'pl-PL';
      this.recognition.continuous = false;
      this.recognition.interimResults = true;

      this.recognition.onstart = () => {
        this.listeningActive = true;
        this.setStatus('listening', '🎤 Słucham... Mów do mikrofonu');
      };

      this.recognition.onresult = (event: SpeechRecognitionEventLike) => {
        if (!event.results || event.results.length === 0) return;
        const lastResult = event.results[event.results.length - 1];
        const transcript = lastResult[0]?.transcript?.trim() || '';

        if (lastResult.isFinal) {
          if (this.textInputElement) {
            this.textInputElement.value = transcript;
          }
          this.submitSpeechInput(transcript);
        } else {
          // Wyświetlanie rozpoznawanego tekstu na żywo w czasie mówienia:
          if (this.voiceStatusElement) {
            this.voiceStatusElement.textContent = `🎤 Słyszę: "${transcript}"...`;
          }
        }
      };

      this.recognition.onerror = (err: SpeechRecognitionErrorEventLike) => {
        this.listeningActive = false;
        // Błąd 'no-speech' oznacza po prostu ciszę:
        if (err.error === 'no-speech') {
          this.setStatus('idle', '🎤 Dotknij "Mów" lub wpisz tekst, aby kontynuować');
        } else if (err.error === 'not-allowed') {
          this.setStatus('error', 'Odmowa dostępu do mikrofonu (użyj wpisywania tekstu).');
        } else {
          this.setStatus('idle', `Mikrofon: ${err.error || 'błąd'}`);
        }
      };

      this.recognition.onend = () => {
        this.listeningActive = false;
        if (this.status === 'listening') {
          this.setStatus('idle', '🎤 Dotknij "Mów" lub wpisz tekst');
        }
      };
    } catch {
      this.setStatus('unsupported', 'Nie udało się zainicjalizować modułu rozpoznawania mowy.');
    }
  }

  private bindUiEvents(): void {
    if (this.sendButton && this.textInputElement) {
      this.sendButton.onclick = () => {
        const text = this.textInputElement?.value.trim();
        if (text) {
          void this.submitSpeechInput(text);
          if (this.textInputElement) this.textInputElement.value = '';
        }
      };

      this.textInputElement.onkeydown = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.sendButton?.click();
        }
      };
    }

    if (this.micButton) {
      this.micButton.onclick = () => {
        if (this.listeningActive) {
          this.stopListening();
        } else {
          this.startListening();
        }
      };
    }

    if (this.replayButton) {
      this.replayButton.onclick = () => {
        this.replayLastSpeech();
      };
    }

    if (this.geminiButton && this.geminiConfigElement) {
      this.geminiButton.onclick = () => {
        const isHidden =
          this.geminiConfigElement!.hasAttribute('hidden') ||
          this.geminiConfigElement!.style.display === 'none';
        if (isHidden) {
          this.openGeminiConfig();
        } else {
          this.closeGeminiConfig();
        }
      };
    }

    if (this.geminiCloseButton) {
      this.geminiCloseButton.onclick = () => {
        this.closeGeminiConfig();
      };
    }

    if (this.geminiSaveButton && this.geminiInputElement) {
      this.geminiSaveButton.onclick = () => {
        const val = this.geminiInputElement!.value.trim();
        if (val) {
          if (val.includes('...')) {
            this.setGeminiStatus('Klucz jest już zapisany.');
            return;
          }
          geminiNpcService.setApiKey(val);
          this.geminiInputElement!.value = geminiNpcService.getMaskedApiKey();
          this.setGeminiStatus('✓ Klucz zapisany w pamięci przeglądarki.');
          this.updateGeminiIndicator();
        } else {
          this.setGeminiStatus('Wprowadź poprawny klucz Gemini API.');
        }
      };
    }

    if (this.geminiClearButton) {
      this.geminiClearButton.onclick = () => {
        geminiNpcService.setApiKey('');
        if (this.geminiInputElement) this.geminiInputElement.value = '';
        this.setGeminiStatus('Klucz usunięty. Rozmowy wymagają klucza Gemini.');
        this.updateGeminiIndicator();
      };
    }

    if (this.elevenLabsSaveButton && this.elevenLabsInputElement) {
      this.elevenLabsSaveButton.onclick = () => {
        const val = this.elevenLabsInputElement!.value.trim();
        if (val) {
          if (val.includes('...')) {
            this.setElevenLabsStatus('Klucz jest już zapisany.');
            return;
          }
          elevenLabsNpcService.setApiKey(val);
          this.elevenLabsInputElement!.value = elevenLabsNpcService.getMaskedApiKey();
          this.setElevenLabsStatus('✓ Klucz zapisany. ElevenLabs aktywne jako główny głos.');
          this.updateGeminiIndicator();
        } else {
          this.setElevenLabsStatus('Wprowadź poprawny klucz ElevenLabs.');
        }
      };
    }

    if (this.elevenLabsClearButton) {
      this.elevenLabsClearButton.onclick = () => {
        elevenLabsNpcService.setApiKey('');
        if (this.elevenLabsInputElement) this.elevenLabsInputElement.value = '';
        this.setElevenLabsStatus('Klucz usunięty. Aktywny fallback: Gemini / Web Speech.');
        this.updateGeminiIndicator();
      };
    }

    this.updateGeminiIndicator();
  }

  openGeminiConfig(): void {
    if (!this.geminiConfigElement) return;
    this.geminiConfigElement.removeAttribute('hidden');
    this.geminiConfigElement.style.display = 'block';

    // Konfiguracja Gemini:
    if (this.geminiInputElement) {
      this.geminiInputElement.value = geminiNpcService.getApiKey() ? geminiNpcService.getMaskedApiKey() : '';
    }
    if (geminiNpcService.hasApiKey()) {
      this.setGeminiStatus('✓ Klucz aktywny (zapisany lokalnie)');
    } else {
      this.setGeminiStatus('Brak klucza API Gemini (wymagany do rozmów z NPC)');
    }

    // Konfiguracja ElevenLabs:
    if (this.elevenLabsInputElement) {
      this.elevenLabsInputElement.value = elevenLabsNpcService.getApiKey()
        ? elevenLabsNpcService.getMaskedApiKey()
        : '';
    }
    if (elevenLabsNpcService.hasApiKey()) {
      if (elevenLabsNpcService.isQuotaExceeded()) {
        this.setElevenLabsStatus(
          '⚠️ Darmowy limit 10k znaków wyczerpany (aktywny fallback: Gemini / Web Speech)',
        );
      } else {
        this.setElevenLabsStatus('✓ Klucz aktywny (ElevenLabs - główny dubbing)');
      }
    } else {
      this.setElevenLabsStatus('Brak klucza (działa fallback do Gemini i Web Speech)');
    }
  }

  closeGeminiConfig(): void {
    if (!this.geminiConfigElement) return;
    this.geminiConfigElement.setAttribute('hidden', '');
    this.geminiConfigElement.style.display = 'none';
  }

  private setGeminiStatus(msg: string): void {
    if (this.geminiStatusElement) {
      this.geminiStatusElement.textContent = msg;
    }
  }

  private setElevenLabsStatus(msg: string): void {
    if (this.elevenLabsStatusElement) {
      this.elevenLabsStatusElement.textContent = msg;
    }
  }

  private updateGeminiIndicator(): void {
    if (this.geminiButton) {
      const hasGemini = geminiNpcService.hasApiKey();
      const hasEleven = elevenLabsNpcService.hasApiKey() && !elevenLabsNpcService.isQuotaExceeded();

      if (hasEleven || hasGemini) {
        this.geminiButton.classList.add('has-gemini');
        const providers = [];
        if (hasEleven) providers.push('ElevenLabs');
        if (hasGemini) providers.push('Gemini AI');
        this.geminiButton.title = `Aktywne: ${providers.join(' + ')} (kliknij, aby skonfigurować)`;
      } else {
        this.geminiButton.classList.remove('has-gemini');
        this.geminiButton.title = 'Konfiguracja głosów ElevenLabs i Gemini AI';
      }
    }
  }

  private resolveDialogueNpcId(npcName: string): string | undefined {
    const lower = npcName.toLowerCase();
    if (lower.includes('ania') || lower.includes('patrol')) return 'pokojowy_patrol_ania';
    if (lower.includes('wiesław') || lower.includes('wieslaw')) return 'woodstock_wieslaw';
    if (lower.includes('mati') || lower.includes('flanki')) return 'flanki_mistrz_mati';
    if (lower.includes('jurek') || lower.includes('owsiak')) return 'jurek';
    if (lower.includes('jan') || lower.includes('kryszn')) return 'krysznowiec_jan';
    if (lower.includes('kuba') || lower.includes('eko')) return 'eko_wolontariusz_kuba';
    return undefined;
  }

  private clearChoices(): void {
    if (this.choicesContainer) {
      this.choicesContainer.innerHTML = '';
    }
  }

  private renderChoices(): void {
    if (!this.choicesContainer) return;
    this.choicesContainer.innerHTML = '';

    const createChoiceButton = (className: string, text: string, onClick: () => void): HTMLButtonElement => {
      if (typeof document === 'undefined') {
        const classes = new Set(className.split(' ').filter(Boolean));
        return {
          className,
          textContent: text,
          onclick: onClick,
          classList: {
            add: (cls: string) => {
              classes.add(cls);
            },
            contains: (cls: string) => classes.has(cls),
          },
        } as unknown as HTMLButtonElement;
      }
      const btn = document.createElement('button');
      btn.className = className;
      btn.textContent = text;
      btn.onclick = onClick;
      return btn;
    };

    if (this.isQuizActive && this.patrolQuiz) {
      if (this.patrolQuiz.isCompleted()) {
        const score = this.patrolQuiz.getScore();
        const finishBtn = createChoiceButton(
          'dialog-choice-btn quiz-choice',
          `Zakończ quiz (Wynik: ${score.correct}/${score.total}) ✓`,
          () => {
            this.isQuizActive = false;
            const dialogueNpcId = this.resolveDialogueNpcId(this.currentNpcName || '');
            if (this.branchingDialogue && dialogueNpcId) {
              this.branchingDialogue.startDialogue(dialogueNpcId);
            }
            this.renderChoices();
          },
        );
        this.choicesContainer.appendChild(finishBtn);
        return;
      }

      const q = this.patrolQuiz.getCurrentQuestion();
      if (!q) return;

      q.choices.forEach((choiceText, index) => {
        const btn = createChoiceButton('dialog-choice-btn quiz-choice', `${index + 1}. ${choiceText}`, () => {
          const feedback = this.patrolQuiz!.submitAnswer(index as 0 | 1 | 2);
          const feedbackText = feedback.isCorrect
            ? `Prawidłowo! ${feedback.explanation}`
            : `Niestety nie. ${feedback.explanation}`;
          this.history.push({ sender: 'Ty', text: choiceText, isPlayer: true });
          this.history.push({ sender: this.currentNpcName || 'Patrol', text: feedbackText, isPlayer: false });
          this.renderHistory();
          const persona = NpcAiAgent.getPersona(this.currentNpcName || '');
          this.speakText(feedbackText, persona.voiceSettings, () => {
            this.renderChoices();
          });
        });
        this.choicesContainer!.appendChild(btn);
      });
      return;
    }

    if (!this.branchingDialogue || !this.branchingDialogue.isDialogueActive()) {
      return;
    }

    const options = this.branchingDialogue.getAvailableOptions();
    options.forEach((opt, index) => {
      const btn = createChoiceButton('dialog-choice-btn', opt.label, () => {
        this.history.push({ sender: 'Ty', text: opt.label, isPlayer: true });

        if (opt.label.toLowerCase().includes('quiz') && this.patrolQuiz) {
          this.isQuizActive = true;
          this.patrolQuiz.reset();
          const q = this.patrolQuiz.getCurrentQuestion();
          const quizIntro = `Rozpoczynamy Quiz Patrolu! Pytanie 1 z 5: ${q?.question}`;
          this.history.push({ sender: this.currentNpcName || 'Ania', text: quizIntro, isPlayer: false });
          this.renderHistory();
          const persona = NpcAiAgent.getPersona(this.currentNpcName || '');
          this.speakText(quizIntro, persona.voiceSettings, () => {
            this.renderChoices();
          });
          return;
        }

        const result = this.branchingDialogue!.selectOption(index);
        if (result) {
          this.history.push({ sender: this.currentNpcName || 'NPC', text: result.text, isPlayer: false });
          this.renderHistory();
          const persona = NpcAiAgent.getPersona(this.currentNpcName || '');
          this.speakText(result.text, persona.voiceSettings, () => {
            this.renderChoices();
          });
        } else {
          this.renderHistory();
          this.renderChoices();
        }
      });
      if (opt.label.toLowerCase().includes('quiz')) {
        btn.classList.add('quiz-choice');
      }
      this.choicesContainer!.appendChild(btn);
    });
  }

  /**
   * Otwiera interakcję z wybranym botem NPC, zatrzymuje jego ruch i zwraca go ku graczowi.
   */
  startConversation(npcName: string, playerPosition?: THREE.Vector3): void {
    this.currentNpcName = npcName;
    this.isQuizActive = false;
    this.updateGeminiIndicator();

    // 1. Zatrzymanie ruchu bota i obrót ku graczowi:
    const npc = this.npcManager.pauseNpcForConversation(npcName, playerPosition);

    // 2. Prezentacja w UI:
    const persona = NpcAiAgent.getPersona(npcName);
    if (this.nameElement) {
      this.nameElement.textContent = `${persona.name} · ${persona.title}`;
    }

    const dialogueNpcId = this.resolveDialogueNpcId(npcName);
    let initialLine = '';

    if (this.branchingDialogue && dialogueNpcId) {
      const node = this.branchingDialogue.startDialogue(dialogueNpcId);
      if (node) {
        initialLine = node.text;
        this.renderChoices();
      }
    }

    if (!initialLine) {
      initialLine =
        npc?.line && npc.line.length > 0
          ? npc.line[Math.floor(Math.random() * npc.line.length)]
          : persona.greetings && persona.greetings.length > 0
            ? persona.greetings[Math.floor(Math.random() * persona.greetings.length)]
            : 'Siemanko! Czym mogę służyć na naszym polu?';
      this.clearChoices();
    }

    this.history = [{ sender: this.currentNpcName, text: initialLine, isPlayer: false }];
    geminiNpcService.recordInitialGreeting(npcName, initialLine);
    this.renderHistory();

    // 3. Wypowiedzenie linii powitalnej przez syntezator mowy:
    this.speakText(initialLine, persona.voiceSettings, () => {
      this.startListening();
    });
  }

  /**
   * Zatrzymuje nasłuchiwanie oraz syntezę i wznawia naturalne poruszanie się NPC.
   */
  endConversation(): void {
    this.stopListening();
    this.cancelSpeaking();
    this.closeGeminiConfig();
    this.clearChoices();
    this.isQuizActive = false;
    if (this.branchingDialogue) {
      this.branchingDialogue.endDialogue();
    }

    if (this.currentNpcName) {
      this.npcManager.resumeNpcAfterConversation(this.currentNpcName, 2.0);
      this.currentNpcName = undefined;
    }

    this.history = [];
    this.setStatus('idle');
  }

  /**
   * Uruchamia nasłuchiwanie mowy przez mikrofon.
   */
  startListening(): boolean {
    if (!this.recognition) return false;
    if (this.listeningActive) return true;

    // Zatrzymujemy mowę bota, gdy gracz zaczyna mówić:
    this.cancelSpeaking();

    try {
      this.recognition.start();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Zatrzymuje nasłuchiwanie mikrofonu.
   */
  stopListening(): void {
    if (this.recognition && this.listeningActive) {
      try {
        this.recognition.stop();
      } catch {
        // Ignorujemy błędy zatrzymania
      }
    }
    this.listeningActive = false;
  }

  /**
   * Przetwarza wejściowy tekst (z mowy lub formularza) przez AI Agenta / Gemini API i odtwarza odpowiedź TTS.
   */
  async submitSpeechInput(input: string): Promise<void> {
    if (!this.currentNpcName || !input.trim()) return;

    this.stopListening();
    this.setStatus('processing', `⏳ ${this.currentNpcName || 'NPC'} myśli nad odpowiedzią...`);

    // 1. Dodanie wypowiedzi gracza do historii rozmowy:
    this.history.push({ sender: 'Ty', text: input.trim(), isPlayer: true });
    this.renderHistory();

    // 2. Wygenerowanie odpowiedzi przez GeminiNpcService (wyłącznie Gemini API):
    const lastNpcEntry = [...this.history].reverse().find((entry) => !entry.isPlayer);
    const context: NpcDialogueContext = {
      lastNpcMessage: lastNpcEntry?.text,
      history: [...this.history],
    };
    const response = await geminiNpcService.generateResponse(this.currentNpcName, input, context);
    const persona = NpcAiAgent.getPersona(this.currentNpcName);

    // 3. Dodanie odpowiedzi NPC do historii (bez technicznych etykiet i badge'y AI):
    this.history.push({ sender: this.currentNpcName, text: response.text, isPlayer: false });
    this.renderHistory();

    if (response.source === 'error') {
      this.setStatus('error', response.error || 'Wymagany klucz Gemini API.');
      if (!geminiNpcService.hasApiKey()) {
        this.openGeminiConfig();
      }
    }

    // 4. Wypowiedzenie odpowiedzi przez syntezator mowy (TTS):
    this.speakText(response.text, persona.voiceSettings, () => {
      if (response.source === 'error') {
        this.setStatus('error', '⚠️ Skonfiguruj klucz Gemini API [⚙️ Gemini], aby kontynuować.');
      } else {
        this.setStatus('idle', '🎤 Gotowy na kolejne pytanie. Dotknij "Mów" lub wpisz tekst.');
      }
    });
  }

  /**
   * Renderuje całą historię rozmowy w oknie dialogu i przewija widok do najnowszej wypowiedzi.
   */
  private renderHistory(): void {
    if (!this.textElement) return;

    const html = this.history
      .map((entry) => {
        const roleClass = entry.isPlayer ? 'dialog-msg-player' : 'dialog-msg-npc';
        return `<div class="dialog-msg ${roleClass}"><strong class="dialog-msg-author">${escapeHtml(entry.sender)}:</strong> <span class="dialog-msg-body">${escapeHtml(entry.text)}</span></div>`;
      })
      .join('');

    this.textElement.innerHTML = html;

    // Wsparcie dla uproszczonych obiektów mock w testach jednostkowych (gdzie innerHTML nie aktualizuje textContent):
    const target = this.textElement as any;
    if (!target.tagName) {
      target.textContent = this.history.map((entry) => `${entry.sender}: ${entry.text}`).join(' ');
    }

    const scrollContainer = this.textElement.parentElement ?? this.textElement;
    if (typeof scrollContainer.scrollTop === 'number' && typeof scrollContainer.scrollHeight === 'number') {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }

  /**
   * Odtwarza tekst za pomocą hierarchicznego potoku głosowego:
   * 1. ElevenLabs (Opcja 2 - realistyczny dubbing, aż do limitu)
   * 2. Gemini Audio (Opcja 1 - ekspresyjne audio AI, gdy ElevenLabs wyczerpie darmowy limit lub wystąpi błąd)
   * 3. Web Speech API (Wbudowany darmowy silnik przeglądarki z modulacją barwy głosu jako bezpiecznik)
   */
  speakText(text: string, voiceSettings: NpcVoiceSettings, onComplete?: () => void): void {
    this.lastSpokenText = text;
    this.lastSpokenVoiceSettings = voiceSettings;

    const cleanedText = cleanTextForSpeech(text);
    if (!cleanedText) {
      onComplete?.();
      return;
    }

    this.cancelSpeaking();

    // Jeśli ElevenLabs jest skonfigurowane i ma limit, lub Gemini ma klucz -> uruchamiamy potok asynchroniczny:
    if (
      (elevenLabsNpcService.hasApiKey() && !elevenLabsNpcService.isQuotaExceeded()) ||
      geminiNpcService.hasApiKey()
    ) {
      void this.speakWithFallbackPipeline(cleanedText, voiceSettings, onComplete);
      return;
    }

    // Bezpośredni fallback do lokalnego Web Speech API (np. brak zewnętrznych kluczy lub środowisko testowe):
    this.speakWebSpeech(cleanedText, voiceSettings, onComplete);
  }

  /**
   * Asynchroniczny potok próbujący kolejno ElevenLabs, następnie Gemini Audio, a ostatecznie Web Speech.
   */
  private async speakWithFallbackPipeline(
    cleanedText: string,
    voiceSettings: NpcVoiceSettings,
    onComplete?: () => void,
  ): Promise<void> {
    const npcName = this.currentNpcName || 'Festiwalowicz';

    // 1. Próba ElevenLabs (Opcja 2 - priorytet aż do wyczerpania darmowego limitu):
    if (elevenLabsNpcService.hasApiKey() && !elevenLabsNpcService.isQuotaExceeded()) {
      const voiceId = elevenLabsNpcService.getVoiceIdForPersona(npcName, voiceSettings.gender);
      this.setStatus('speaking', `🗣️ ${npcName} mówi...`);
      const audioBuffer = await elevenLabsNpcService.synthesizeSpeech(cleanedText, voiceId);

      if (audioBuffer && !this.disposed) {
        const audio = elevenLabsNpcService.playAudioBuffer(
          audioBuffer,
          () => this.setStatus('speaking', `🗣️ ${npcName} mówi...`),
          () => {
            this.setStatus('idle', '🎤 Dotknij "Mów" lub wpisz tekst');
            onComplete?.();
          },
        );
        if (audio) return;
      }
    }

    // 2. Próba Gemini Audio (Opcja 1 - fallback przy wyczerpaniu limitu ElevenLabs):
    if (geminiNpcService.hasApiKey()) {
      const geminiAudio = await geminiNpcService.synthesizeSpeechAudio(
        cleanedText,
        npcName,
        voiceSettings.gender,
      );
      if (geminiAudio && !this.disposed) {
        const played = await geminiNpcService.playAudioData(
          geminiAudio.audioData,
          geminiAudio.mimeType,
          () => this.setStatus('speaking', `🗣️ ${npcName} mówi...`),
          () => {
            this.setStatus('idle', '🎤 Dotknij "Mów" lub wpisz tekst');
            onComplete?.();
          },
        );
        if (played) return;
      }
    }

    // 3. Bezpiecznik ostateczny: wbudowany Web Speech API przeglądarki
    this.speakWebSpeech(cleanedText, voiceSettings, onComplete);
  }

  /**
   * Odtwarza tekst za pomocą wbudowanego syntezatora przeglądarki (Web SpeechSynthesis) z dopasowaną barwą głosu postaci.
   */
  speakWebSpeech(cleanedText: string, voiceSettings: NpcVoiceSettings, onComplete?: () => void): void {
    const synth = this.getSpeechSynthesis();
    const UtteranceConstructor = this.getSpeechSynthesisUtterance();
    if (!synth || !UtteranceConstructor) {
      onComplete?.();
      return;
    }

    try {
      synth.resume();
    } catch {
      // Ignorujemy błędy wznawiania audio context
    }

    const utterance = new UtteranceConstructor(cleanedText);
    utterance.lang = 'pl-PL';
    utterance.rate = Math.max(0.6, Math.min(1.8, voiceSettings.rate ?? 1.0));
    utterance.volume = Math.max(0.1, Math.min(1.0, voiceSettings.volume ?? 1.0));

    // Wyszukanie głosów zainstalowanych w przeglądarce (z preferencją języka polskiego i płci postaci):
    const voices = this.voices.length > 0 ? this.voices : synth.getVoices();
    const polishVoices = voices.filter((v) => v.lang.startsWith('pl') || v.lang.toLowerCase().includes('pl'));

    const isFemale = voiceSettings.gender === 'female';
    const femaleVoiceRegex =
      /(paulina|agnieszka|zofia|zosia|ewa|maja|anna|monika|aleksandra|magda|katarzyna|female|kobieta|woman|girl|helena|sabina|zira|kalina)/i;
    const maleVoiceRegex =
      /(adam|marek|krzysztof|jan|piotr|tomasz|male|mezczyzna|man|boy|david|george|mateusz)/i;

    let selectedVoice: SpeechSynthesisVoice | undefined;
    if (isFemale) {
      selectedVoice =
        polishVoices.find((v) => femaleVoiceRegex.test(v.name) || femaleVoiceRegex.test(v.voiceURI)) ||
        polishVoices[0];
      // Kobieca modulacja tonu (pitch): gwarantuje kobiece brzmienie nawet na pojedynczym zainstalowanym głosie:
      const basePitch = voiceSettings.pitch ?? 1.3;
      utterance.pitch = Math.max(1.24, Math.min(1.85, basePitch < 1.15 ? basePitch * 1.32 : basePitch));
    } else {
      selectedVoice =
        polishVoices.find((v) => maleVoiceRegex.test(v.name) || maleVoiceRegex.test(v.voiceURI)) ||
        polishVoices[0];
      const basePitch = voiceSettings.pitch ?? 0.9;
      utterance.pitch = Math.max(0.65, Math.min(1.05, basePitch > 1.15 ? basePitch * 0.85 : basePitch));
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    this.activeUtterances.add(utterance);

    utterance.onstart = () => {
      this.setStatus('speaking', `🗣️ ${this.currentNpcName || 'NPC'} mówi...`);
    };

    const cleanup = () => {
      this.activeUtterances.delete(utterance);
      if (this.currentUtterance === utterance) {
        this.currentUtterance = undefined;
      }
      onComplete?.();
    };

    utterance.onend = cleanup;
    utterance.onerror = () => {
      cleanup();
    };

    this.currentUtterance = utterance;

    // Krótkie opóźnienie przed speak() zapobiega bugowi Blink/Chrome, gdzie cancel() natychmiast anuluje nową wypowiedź:
    setTimeout(() => {
      if (!this.disposed) {
        const liveSynth = this.getSpeechSynthesis();
        if (liveSynth) {
          liveSynth.speak(utterance);
        }
      }
    }, 30);
  }

  /**
   * Powtarza ostatnią wypowiedź bota.
   */
  replayLastSpeech(): void {
    if (this.lastSpokenText) {
      this.speakText(this.lastSpokenText, this.lastSpokenVoiceSettings);
    }
  }

  /**
   * Natychmiast przerywa trwające wypowiedzi syntezatora i odtwarzaczy audio.
   */
  cancelSpeaking(): void {
    elevenLabsNpcService.cancelPlayback();
    geminiNpcService.cancelAudioPlayback();

    const synth = this.getSpeechSynthesis();
    if (synth) {
      try {
        synth.cancel();
      } catch {
        // Ignorujemy błędy przerwania
      }
    }
    this.activeUtterances.clear();
    this.currentUtterance = undefined;
  }

  private setStatus(status: VoiceCoordinatorStatus, message?: string): void {
    this.status = status;
    if (this.voiceStatusElement && message) {
      this.voiceStatusElement.textContent = message;
    }
    this.onStatusChange?.(status, message);
  }

  getStatus(): VoiceCoordinatorStatus {
    return this.status;
  }

  getCurrentNpcName(): string | undefined {
    return this.currentNpcName;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.endConversation();
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        // ignore
      }
      this.recognition = undefined;
    }
  }
}
