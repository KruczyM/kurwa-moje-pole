export interface ElevenLabsVoiceProfile {
  voiceId: string;
  name: string;
  description: string;
}

export class ElevenLabsNpcService {
  private static readonly STORAGE_KEY = 'elevenlabs_api_key';

  // Standardowe, wbudowane darmowe głosy dostępne na każdym darmowym koncie ElevenLabs:
  // - Adam (męski, głęboki, wyrazisty - idealny dla rockmana, pnia, motocyklisty)
  // - Antoni (męski, zrównoważony, bardzo naturalny po polsku)
  // - Josh (męski, młody, luźny - raver, hipis)
  // - Rachel (żeński, ciepły, spokojny - hipiska, kosmitka)
  // - Domi (żeński, energiczny, mocny - Korba, parówka)
  // - Bella (żeński, miękki, melodyjny)
  public static readonly DEFAULT_VOICES: Record<string, ElevenLabsVoiceProfile> = {
    adam: {
      voiceId: 'pNInz6obpgDQGcFmaJgB',
      name: 'Adam',
      description: 'Głęboki, szorstki głos męski (rockman/weteran)',
    },
    antoni: { voiceId: 'ErXwobaYiN019PkySvjV', name: 'Antoni', description: 'Naturalny, ciepły głos męski' },
    josh: { voiceId: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', description: 'Młody, festiwalowy głos męski' },
    rachel: {
      voiceId: '21m00Tcm4TlvDq8ikWAM',
      name: 'Rachel',
      description: 'Ciepły, narracyjny głos kobiecy',
    },
    domi: {
      voiceId: 'AZnzlk1XvdvUeBnXmlld',
      name: 'Domi',
      description: 'Energiczny, zadziorny głos kobiecy',
    },
    bella: {
      voiceId: 'EXAVITQu4vr4xnSDxMaL',
      name: 'Bella',
      description: 'Melodyjny, hipisowski głos kobiecy',
    },
  };

  private quotaExceeded = false;
  private currentAudio?: HTMLAudioElement;

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
   * Pobiera klucz API ElevenLabs z localStorage lub zmiennych środowiskowych Vite.
   */
  getApiKey(): string | undefined {
    const storage = this.getStorage();
    if (storage) {
      const stored = storage.getItem(ElevenLabsNpcService.STORAGE_KEY);
      if (stored && stored.trim().length > 0) {
        return stored.trim();
      }
    }

    try {
      const envKey = import.meta.env?.VITE_ELEVENLABS_API_KEY;
      if (typeof envKey === 'string' && envKey.trim().length > 0) {
        return envKey.trim();
      }
    } catch {
      // Ignorujemy błędy w środowisku testowym
    }

    return undefined;
  }

  /**
   * Zapisuje lub usuwa klucz API ElevenLabs w localStorage.
   */
  setApiKey(key?: string): void {
    const storage = this.getStorage();
    if (!storage) return;
    const cleanKey = key?.trim();
    if (cleanKey) {
      storage.setItem(ElevenLabsNpcService.STORAGE_KEY, cleanKey);
      this.resetQuotaStatus();
    } else {
      storage.removeItem(ElevenLabsNpcService.STORAGE_KEY);
      this.resetQuotaStatus();
    }
  }

  /**
   * Sprawdza, czy klucz API jest skonfigurowany.
   */
  hasApiKey(): boolean {
    return Boolean(this.getApiKey());
  }

  /**
   * Zwraca zamaskowany klucz do bezpiecznego wyświetlenia w UI.
   */
  getMaskedApiKey(): string {
    const key = this.getApiKey();
    if (!key) return '';
    if (key.length <= 8) return '********';
    return `${key.slice(0, 6)}...${key.slice(-4)}`;
  }

  /**
   * Informuje, czy darmowy limit znaków ElevenLabs został wyczerpany.
   */
  isQuotaExceeded(): boolean {
    return this.quotaExceeded;
  }

  /**
   * Resetuje flagę wyczerpania limitu (np. po zmianie klucza lub w nowym miesiącu).
   */
  resetQuotaStatus(): void {
    this.quotaExceeded = false;
  }

  /**
   * Dobiera odpowiedni identyfikator głosu ElevenLabs na podstawie tożsamości postaci.
   */
  getVoiceIdForPersona(npcName: string, gender?: 'male' | 'female'): string {
    const lower = npcName.toLowerCase();

    if (
      gender === 'female' ||
      lower.includes('korba') ||
      lower.includes('girl') ||
      lower.includes('kosmitka') ||
      lower.includes('parówk')
    ) {
      if (lower.includes('korba') || lower.includes('parówk') || lower.includes('punk')) {
        return ElevenLabsNpcService.DEFAULT_VOICES.domi.voiceId;
      }
      if (lower.includes('hippie') || lower.includes('boho') || lower.includes('flower')) {
        return ElevenLabsNpcService.DEFAULT_VOICES.bella.voiceId;
      }
      return ElevenLabsNpcService.DEFAULT_VOICES.rachel.voiceId;
    }

    // Mężczyźni / rockmani / motocykliści:
    if (
      lower.includes('pień') ||
      lower.includes('peposz') ||
      lower.includes('hemoroid') ||
      lower.includes('zawór') ||
      lower.includes('biker') ||
      lower.includes('metal') ||
      lower.includes('grunge') ||
      lower.includes('dziąsło') ||
      lower.includes('krwiak')
    ) {
      return ElevenLabsNpcService.DEFAULT_VOICES.adam.voiceId;
    }

    if (
      lower.includes('raver') ||
      lower.includes('dino') ||
      lower.includes('glow') ||
      lower.includes('frog')
    ) {
      return ElevenLabsNpcService.DEFAULT_VOICES.josh.voiceId;
    }

    return ElevenLabsNpcService.DEFAULT_VOICES.antoni.voiceId;
  }

  /**
   * Wysyła zapytanie do ElevenLabs Text-to-Speech API.
   * W przypadku przekroczenia limitu (kod 429 lub quota_exceeded) oznacza quotaExceeded i zwraca null.
   */
  async synthesizeSpeech(text: string, voiceId: string): Promise<ArrayBuffer | null> {
    if (this.quotaExceeded) {
      return null;
    }

    const apiKey = this.getApiKey();
    if (!apiKey) {
      return null;
    }

    const trimmed = text.trim();
    if (!trimmed) {
      return null;
    }

    try {
      const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: trimmed,
          model_id: 'eleven_multilingual_v2', // Najlepszy model z natywnym wsparciem języka polskiego
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.2,
            use_speaker_boost: true,
          },
        }),
      });

      if (response.ok) {
        return await response.arrayBuffer();
      }

      // Analiza błędów limitu (np. darmowe 10 000 znaków wyczerpane):
      const errorText = await response.text().catch(() => '');
      if (response.status === 429 || errorText.toLowerCase().includes('quota') || response.status === 401) {
        console.warn(
          `[ElevenLabsNpcService] Limit darmowych znaków ElevenLabs osiągnięty (${response.status}): ${errorText}`,
        );
        this.quotaExceeded = true;
      } else {
        console.warn(`[ElevenLabsNpcService] Błąd syntezy (${response.status}): ${errorText}`);
      }
      return null;
    } catch (err) {
      console.warn('[ElevenLabsNpcService] Błąd połączenia z ElevenLabs:', err);
      return null;
    }
  }

  /**
   * Odtwarza pobrany bufor audio za pomocą przeglądarkowego HTMLAudioElement.
   */
  playAudioBuffer(
    buffer: ArrayBuffer,
    onStart?: () => void,
    onComplete?: () => void,
  ): HTMLAudioElement | undefined {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') {
      onComplete?.();
      return undefined;
    }

    this.cancelPlayback();

    try {
      const blob = new Blob([buffer], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);

      const cleanup = () => {
        URL.revokeObjectURL(audioUrl);
        if (this.currentAudio === audio) {
          this.currentAudio = undefined;
        }
        onComplete?.();
      };

      audio.onplay = () => {
        onStart?.();
      };
      audio.onended = cleanup;
      audio.onerror = cleanup;

      this.currentAudio = audio;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('[ElevenLabsNpcService] Autoplay prevented or playback error:', err);
          cleanup();
        });
      }

      return audio;
    } catch (err) {
      console.warn('[ElevenLabsNpcService] Playback init failed:', err);
      onComplete?.();
      return undefined;
    }
  }

  /**
   * Zatrzymuje aktualnie odtwarzane audio z ElevenLabs.
   */
  cancelPlayback(): void {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch {
        // ignore
      }
      this.currentAudio = undefined;
    }
  }
}

export const elevenLabsNpcService = new ElevenLabsNpcService();
