import { NpcAiAgent, type NpcPersona, type NpcDialogueContext } from './NpcAiAgent';

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface GeminiResponseResult {
  text: string;
  source: 'gemini' | 'error';
  modelUsed?: string;
  error?: string;
}

export class GeminiNpcService {
  private static readonly STORAGE_KEY = 'gemini_api_key';
  private static readonly DEFAULT_MODELS = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash'];

  // Historia rozmów z poszczególnymi NPC-ami (do 6 ostatnich wypowiedzi)
  private conversationHistory: Map<string, ChatMessage[]> = new Map();

  private getStorage(): Storage | undefined {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
      return (globalThis as any).localStorage;
    }
    return undefined;
  }

  /**
   * Pobiera klucz API Gemini z localStorage lub ze zmiennej środowiskowej Vite.
   */
  getApiKey(): string | undefined {
    const storage = this.getStorage();
    if (storage) {
      const stored = storage.getItem(GeminiNpcService.STORAGE_KEY);
      if (stored && stored.trim().length > 0) {
        return stored.trim();
      }
    }

    try {
      const envKey = import.meta.env?.VITE_GEMINI_API_KEY;
      if (typeof envKey === 'string' && envKey.trim().length > 0) {
        return envKey.trim();
      }
    } catch {
      // Ignorujemy błędy dostępu do import.meta.env w specyficznych środowiskach testowych
    }

    return undefined;
  }

  /**
   * Zapisuje lub usuwa klucz API Gemini w localStorage.
   */
  setApiKey(key?: string): void {
    const storage = this.getStorage();
    if (!storage) return;
    const cleanKey = key?.trim();
    if (cleanKey) {
      storage.setItem(GeminiNpcService.STORAGE_KEY, cleanKey);
    } else {
      storage.removeItem(GeminiNpcService.STORAGE_KEY);
    }
  }

  /**
   * Sprawdza, czy klucz API jest skonfigurowany.
   */
  hasApiKey(): boolean {
    return Boolean(this.getApiKey());
  }

  /**
   * Zwraca zamaskowany klucz do bezpiecznego wyświetlenia w UI (np. "AIzaSy...4X9").
   */
  getMaskedApiKey(): string {
    const key = this.getApiKey();
    if (!key) return '';
    if (key.length <= 8) return '********';
    return `${key.slice(0, 6)}...${key.slice(-4)}`;
  }

  /**
   * Buduje szczegółową instrukcję systemową (System Instruction) dla Gemini
   * w oparciu o tożsamość, styl bycia i wiedzę festiwalową danej postaci.
   */
  buildSystemPrompt(npcName: string): string {
    const persona: NpcPersona = NpcAiAgent.getPersona(npcName);
    const greetingsSample = persona.greetings.slice(0, 2).join(' / ');
    const identityDesc = persona.identity.join(' ');
    const loreKeys = Object.keys(persona.festivalLore || {})
      .slice(0, 4)
      .join(', ');

    const isFemale = persona.voiceSettings?.gender === 'female';
    const genderInstruction = isFemale
      ? "TWOJA PŁEĆ: KOBIETA. Wypowiadaj się gramatycznie w 1. osobie jako kobieta (używaj żeńskich końcówek czasu przeszłego i trybu przypuszczającego: 'byłam', 'widziałam', 'chciałabym', 'poszłam', 'zrobiłam', 'słyszałam')."
      : "TWOJA PŁEĆ: MĘŻCZYZNA. Wypowiadaj się gramatycznie w 1. osobie jako mężczyzna (używaj męskich końcówek: 'byłem', 'widziałem', 'chciałbym', 'poszedłem', 'zrobiłem', 'słyszałem').";

    return `Jesteś postacią "${persona.name}" (${persona.title}) w grze "Kurwa Moje Pole", osadzonej w realiach festiwalu Pol'and'Rock (dawny Przystanek Woodstock) na dawnym pasie startowym lotniska Czaplinek-Broczyno w obozie "Kurwa Moje Pole".

TWOJA OSOBOWOŚĆ I TOŻSAMOŚĆ:
${genderInstruction}
${identityDesc}
Twoje charakterystyczne hasła i styl: ${persona.genericCatchphrases.join(' ')}
Przykładowy ton wypowiedzi: "${greetingsSample}"
Tematy, na których się znasz: ${loreKeys}.

ŻELAZNE ZASADY TWOICH ODPOWIEDZI:
1. Odpowiadaj ZAWSZE w 1. osobie ("ja"), wczuwając się w swoją postać na 100%.
2. Używaj naturalnego, barwnego języka polskiego i klimatycznego slangu festiwalowego (np. "Siemanko!", "brachu", "pogo", "Duża Scena", "ASP", "zimne piwko", "błoto", a na okrzyk "Zaraz będzie ciemno!" tradycyjne "ZAMKNIJ SIĘ!").
3. ODPOWIEDŹ MUSI BYĆ KRÓTKA: MAKSYMALNIE 1 DO 3 ZDAŃ! Twoja wypowiedź będzie natychmiast czytana na głos przez syntezator mowy (TTS). Gracz nie chce słuchać długich monologów.
4. ZAKAZ FORMATOWANIA MARKDOWN: Żadnych gwiazdek (*), żadnych podwójnych gwiazdek (**), żadnych nawiasów z opisem czynności typu *(uśmiecha się)* ani emotikonów. Pisz wyłącznie czyste słowa, które brzmią dobrze wypowiedziane na głos.
5. Zachowaj humor, wolność, braterstwo i szacunek dla innych festiwalowiczów.`;
  }

  /**
   * Czyści tekst odpowiedzi z ewentualnych pozostałości markdown, cudzysłowów czy nawiasów.
   */
  cleanResponseText(rawText: string): string {
    return rawText
      .replace(/^["']|["']$/g, '') // Usuń cudzysłowy otaczające całą wypowiedź
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Zachowaj treść pogrubień: **tekst** -> tekst
      .replace(/\*[^*]+\*/g, '') // Usuń didaskalia w gwiazdkach np. *uśmiecha się*
      .replace(/[_~`#]/g, '') // Usuń pozostałe znaczniki markdown
      .replace(/\([^)]*\)/g, '') // Usuń didaskalia w nawiasach okrągłych np. (śmieje się)
      .replace(/\[[^\]]*\]/g, '') // Usuń didaskalia w nawiasach kwadratowych
      .replace(
        /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
        '',
      ) // Usuń emotikony
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Zapisuje powitanie początkowe wypowiedziane przez NPC do historii rozmowy,
   * aby model Gemini oraz fallback miały pełen kontekst od samego początku.
   */
  recordInitialGreeting(npcName: string, greetingText: string): void {
    const trimmed = greetingText?.trim();
    if (!trimmed) return;
    const history = this.conversationHistory.get(npcName) || [];
    if (history.length === 0) {
      history.push({ role: 'model', text: trimmed });
      this.conversationHistory.set(npcName, history);
    }
  }

  /**
   * Generuje odpowiedź NPC na pytanie gracza WYŁĄCZNIE z użyciem Gemini API.
   * Silnik offline został trwale usunięty – dialogi wymagają aktywnego klucza Gemini.
   */
  async generateResponse(
    npcName: string,
    userMessage: string,
    context?: NpcDialogueContext,
  ): Promise<GeminiResponseResult> {
    const trimmedInput = userMessage.trim();
    if (!trimmedInput) {
      const persona = NpcAiAgent.getPersona(npcName);
      const fallbackLine = persona.greetings[0] || 'Siemanko! Czym mogę służyć na naszym polu?';
      return {
        text: fallbackLine,
        source: 'gemini',
      };
    }

    const apiKey = this.getApiKey();
    if (!apiKey) {
      return {
        text: 'Do rozmowy z mieszkańcami obozu wymagany jest klucz Gemini API. Kliknij przycisk [⚙️ Gemini] i wprowadź bezpłatny klucz z Google AI Studio.',
        source: 'error',
        error: 'Brak klucza Gemini API. Wprowadź klucz w ustawieniach dialogu.',
      };
    }

    // Pobranie lub utworzenie historii dialogu z danym NPC
    const history = this.conversationHistory.get(npcName) || [];
    // Jeśli historia była pusta, a przekazano poprzednią kwestię NPC, zainicjuj historię:
    if (history.length === 0 && context?.lastNpcMessage?.trim()) {
      history.push({ role: 'model', text: context.lastNpcMessage.trim() });
    }
    const systemPrompt = this.buildSystemPrompt(npcName);

    let lastError = '';

    // Próba wywołania Gemini z mechanizmem fallbacku modeli
    for (const model of GeminiNpcService.DEFAULT_MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const contents = [
          ...history.map((turn) => ({
            role: turn.role,
            parts: [{ text: turn.text }],
          })),
          {
            role: 'user',
            parts: [{ text: trimmedInput }],
          },
        ];

        const payload = {
          system_instruction: {
            parts: [{ text: systemPrompt }],
          },
          contents,
          generationConfig: {
            temperature: 0.85,
            maxOutputTokens: 200,
          },
        };

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          lastError = `Status ${response.status}: ${errorText}`;
          console.warn(`[GeminiNpcService] Model ${model} returned ${response.status}: ${errorText}`);
          // Jeśli to błąd 404 (model not found), próbuj kolejnego modelu
          if (response.status === 404) continue;
          // Inny błąd (np. 400 Bad Request, 403 Forbidden - nieprawidłowy klucz)
          break;
        }

        const data = await response.json();
        const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (candidate && typeof candidate === 'string') {
          const cleanedText = this.cleanResponseText(candidate);
          if (cleanedText.length > 0) {
            // Zapisz do historii rozmów
            history.push({ role: 'user', text: trimmedInput });
            history.push({ role: 'model', text: cleanedText });
            // Ogranicz do 6 ostatnich wiadomości
            if (history.length > 6) {
              history.splice(0, history.length - 6);
            }
            this.conversationHistory.set(npcName, history);

            return {
              text: cleanedText,
              source: 'gemini',
              modelUsed: model,
            };
          }
        }
      } catch (err: any) {
        lastError = err?.message || String(err);
        console.warn(`[GeminiNpcService] Failed connecting to Gemini with model ${model}:`, err);
      }
    }

    return {
      text: 'Nie udało się połączyć z modelem Gemini AI. Sprawdź poprawność klucza i połączenie z siecią w panelu [⚙️ Gemini].',
      source: 'error',
      error: lastError || 'Nie udało się uzyskać odpowiedzi od Gemini API.',
    };
  }

  /**
   * Czyści historię dialogu dla danego NPC lub dla wszystkich.
   */
  clearHistory(npcName?: string): void {
    if (npcName) {
      this.conversationHistory.delete(npcName);
    } else {
      this.conversationHistory.clear();
    }
  }

  private currentAudioElement?: HTMLAudioElement;
  private currentAudioSource?: AudioBufferSourceNode;
  private audioCtx?: AudioContext;

  /**
   * Syntezuje audio wypowiedzi postaci przez multimodalne API Gemini (Opcja 1).
   * Zwraca dane audio w formacie base64 oraz mimeType, lub null w razie niepowodzenia.
   */
  async synthesizeSpeechAudio(
    text: string,
    npcName: string,
    gender?: 'male' | 'female',
  ): Promise<{ audioData: string; mimeType: string } | null> {
    const apiKey = this.getApiKey();
    if (!apiKey) return null;
    const trimmed = text.trim();
    if (!trimmed) return null;

    const isFemale =
      gender === 'female' ||
      npcName.toLowerCase().includes('korba') ||
      npcName.toLowerCase().includes('girl') ||
      npcName.toLowerCase().includes('kosmitka');
    const voiceName = isFemale ? 'Aoede' : 'Puck';

    for (const model of ['gemini-2.5-flash', 'gemini-2.0-flash']) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const payload = {
          contents: [
            {
              parts: [
                {
                  text: `Mów naturalnie po polsku jako postać "${npcName}": ${trimmed}`,
                },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName,
                },
              },
            },
          },
        };

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          const data = await response.json();
          const inlineData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
          if (inlineData?.data) {
            return {
              audioData: inlineData.data,
              mimeType: inlineData.mimeType || 'audio/mp3',
            };
          }
        }
      } catch (err) {
        console.warn(`[GeminiNpcService] Audio synthesis attempt failed for ${model}:`, err);
      }
    }

    return null;
  }

  /**
   * Odtwarza wygenerowane audio z Gemini API (wspiera formaty mp3/wav/ogg lub surowy strumień PCM).
   */
  async playAudioData(
    audioData: string,
    mimeType: string,
    onStart?: () => void,
    onComplete?: () => void,
  ): Promise<boolean> {
    if (typeof window === 'undefined') {
      onComplete?.();
      return false;
    }

    this.cancelAudioPlayback();

    // Jeśli mimeType to format obsługiwany przez HTMLAudioElement:
    if (
      mimeType.includes('mp3') ||
      mimeType.includes('mpeg') ||
      mimeType.includes('wav') ||
      mimeType.includes('ogg')
    ) {
      try {
        const audio = new Audio(`data:${mimeType};base64,${audioData}`);
        this.currentAudioElement = audio;
        const cleanup = () => {
          if (this.currentAudioElement === audio) {
            this.currentAudioElement = undefined;
          }
          onComplete?.();
        };
        audio.onplay = () => onStart?.();
        audio.onended = cleanup;
        audio.onerror = cleanup;
        await audio.play();
        return true;
      } catch (err) {
        console.warn('[GeminiNpcService] HTML Audio playback failed:', err);
      }
    }

    // Fallback dla surowego strumienia PCM:
    try {
      const AudioCtxConstructor = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxConstructor) {
        onComplete?.();
        return false;
      }

      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AudioCtxConstructor();
      }
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      const binaryString = atob(audioData);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const int16 = new Int16Array(bytes.buffer);
      const audioBuffer = this.audioCtx.createBuffer(1, int16.length, 24000);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < int16.length; i++) {
        channelData[i] = int16[i] / 32768;
      }

      const source = this.audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioCtx.destination);

      source.onended = () => {
        if (this.currentAudioSource === source) {
          this.currentAudioSource = undefined;
        }
        onComplete?.();
      };

      this.currentAudioSource = source;
      onStart?.();
      source.start();
      return true;
    } catch (err) {
      console.warn('[GeminiNpcService] Web Audio PCM playback failed:', err);
      onComplete?.();
      return false;
    }
  }

  /**
   * Zatrzymuje aktywne odtwarzanie audio z Gemini.
   */
  cancelAudioPlayback(): void {
    if (this.currentAudioElement) {
      try {
        this.currentAudioElement.pause();
        this.currentAudioElement.currentTime = 0;
      } catch {}
      this.currentAudioElement = undefined;
    }
    if (this.currentAudioSource) {
      try {
        this.currentAudioSource.stop();
      } catch {}
      this.currentAudioSource = undefined;
    }
  }
}

export const geminiNpcService = new GeminiNpcService();
