/**
 * ConcertState — Sygnał stanu koncertu i reakcje tłumu (#KURWAMOJEPOLE).
 *
 * Zadanie D3 z docs/attractions-plan.md:
 * - Stany: 'idle' | 'intro' | 'playing' | 'cheering' | 'applause' | 'encore'.
 * - Wzorzec obserwatora: onStateChange(callback) z czystym wyrejestrowaniem (unsubscribe).
 * - Deterministyczne przesunięcia czasowe (staggered timing offsets) per NPC na podstawie seed/id.
 * - Zapobieganie jednoczesnemu, nienaturalnemu ("robociemu") klaskaniu/wiwatowaniu widowni.
 * - 100% deterministyczny kod, zero zewnętrznych API.
 */

export type ConcertPhase = 'idle' | 'intro' | 'playing' | 'cheering' | 'applause' | 'encore';

export type ConcertStateName = ConcertPhase;

export const CONCERT_PHASES: readonly ConcertPhase[] = [
  'idle',
  'intro',
  'playing',
  'cheering',
  'applause',
  'encore',
] as const;

export interface ConcertStateChangeEvent {
  phase: ConcertPhase;
  previousPhase: ConcertPhase;
  timestamp: number;
  trackId?: string;
}

export type ConcertStateListener = (phase: ConcertPhase, event: ConcertStateChangeEvent) => void;

export interface ConcertStateOptions {
  initialPhase?: ConcertPhase;
  initialTrackId?: string;
  defaultReactionWindow?: [minSeconds: number, maxSeconds: number];
}

/**
 * Deterministyczny hash FNV-1a przekształcający identyfikator NPC na 32-bitową liczbę całkowitą.
 */
function hashNpcId(id: string | number): number {
  if (typeof id === 'number') {
    let x = (id ^ 0x6d2b79f5) >>> 0;
    x = Math.imul(x ^ (x >>> 15), 1 | x);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return (x ^ (x >>> 14)) >>> 0;
  }

  let hash = 2166136261;
  const str = String(id);
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Zwraca znormalizowaną wartość pseudolosową [0, 1) dla danego NPC i opcjonalnego dodatkowego ziarna.
 */
function sampleNpcRandom(id: string | number, salt = 0): number {
  const h = (hashNpcId(id) ^ Math.imul(salt, 0x85ebca6b)) >>> 0;
  return (h % 100_000) / 100_000;
}

export class ConcertState {
  private currentPhase: ConcertPhase;
  private prevPhase: ConcertPhase;
  private currentTrackId?: string;
  private phaseStartTimestamp: number;
  private readonly listeners = new Set<ConcertStateListener>();
  private readonly reactionWindow: [number, number];

  constructor(options: ConcertStateOptions = {}) {
    this.currentPhase = options.initialPhase ?? 'idle';
    this.prevPhase = this.currentPhase;
    this.currentTrackId = options.initialTrackId;
    this.phaseStartTimestamp = 0;
    this.reactionWindow = options.defaultReactionWindow ?? [0.2, 2.4];
  }

  /**
   * Zwraca bieżącą fazę koncertu.
   */
  get phase(): ConcertPhase {
    return this.currentPhase;
  }

  /**
   * Zwraca poprzednią fazę koncertu sprzed ostatniego przejścia.
   */
  get previousPhase(): ConcertPhase {
    return this.prevPhase;
  }

  /**
   * Zwraca identyfikator aktualnego utworu muzycznego, jeśli zdefiniowano.
   */
  get trackId(): string | undefined {
    return this.currentTrackId;
  }

  /**
   * Znacznik czasu (w sekundach lub ms gry), w którym rozpoczęła się bieżąca faza.
   */
  get phaseStartedAt(): number {
    return this.phaseStartTimestamp;
  }

  /**
   * Sprawdza, czy na scenie trwa aktywność muzyczna lub reakcja (nie 'idle').
   */
  get isPlaying(): boolean {
    return this.currentPhase !== 'idle';
  }

  /**
   * Alias dla get phase().
   */
  getPhase(): ConcertPhase {
    return this.currentPhase;
  }

  /**
   * Alias dla get previousPhase().
   */
  getPreviousPhase(): ConcertPhase {
    return this.prevPhase;
  }

  /**
   * Zwraca czas trwania bieżącej fazy w sekundach.
   */
  getElapsedSeconds(currentTimestamp: number): number {
    return Math.max(0, currentTimestamp - this.phaseStartTimestamp);
  }

  /**
   * Ustawia nową fazę koncertu i powiadamia wszystkich subskrybentów.
   */
  setPhase(nextPhase: ConcertPhase, options?: { timestamp?: number; trackId?: string }): void {
    const timestamp = options?.timestamp ?? this.phaseStartTimestamp;
    const trackId = options?.trackId ?? this.currentTrackId;

    if (this.currentPhase === nextPhase && this.currentTrackId === trackId) {
      return;
    }

    const previous = this.currentPhase;
    this.prevPhase = previous;
    this.currentPhase = nextPhase;
    this.phaseStartTimestamp = timestamp;
    if (options?.trackId !== undefined) {
      this.currentTrackId = options.trackId;
    }

    const event: ConcertStateChangeEvent = {
      phase: nextPhase,
      previousPhase: previous,
      timestamp,
      trackId: this.currentTrackId,
    };

    // Kopia kolekcji zapobiega błędom w razie modyfikacji subskrypcji wewnątrz listenera
    const copy = Array.from(this.listeners);
    for (const listener of copy) {
      listener(nextPhase, event);
    }
  }

  /**
   * Semantyczny alias setPhase.
   */
  transitionTo(nextPhase: ConcertPhase, options?: { timestamp?: number; trackId?: string }): boolean {
    if (this.currentPhase === nextPhase) {
      return false;
    }
    this.setPhase(nextPhase, options);
    return true;
  }

  /**
   * Rejestruje obserwatora zmian stanu koncertu.
   * Zwraca funkcję anulującą subskrypcję (clean unsubscribe).
   */
  onStateChange(listener: ConcertStateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Alias dla onStateChange.
   */
  subscribe(listener: ConcertStateListener): () => void {
    return this.onStateChange(listener);
  }

  /**
   * Oblicza deterministyczne przesunięcie reakcji dla danego NPC (w sekundach).
   * Gwarantuje, że różni widzowie zareagują w różnym czasie w oknie [minDelay, maxDelay].
   */
  getReactionOffset(
    npcId: string | number,
    minDelay = this.reactionWindow[0],
    maxDelay = this.reactionWindow[1],
  ): number {
    const r = sampleNpcRandom(npcId);
    return minDelay + r * (maxDelay - minDelay);
  }

  /**
   * Sprawdza, czy dany NPC już rozpoczął reakcję na bieżącą fazę,
   * porównując czas jaki upłynął w bieżącej fazie z jego indywidualnym offsetem.
   */
  isNpcReacting(
    npcId: string | number,
    elapsedSeconds: number,
    minDelay = this.reactionWindow[0],
    maxDelay = this.reactionWindow[1],
  ): boolean {
    const offset = this.getReactionOffset(npcId, minDelay, maxDelay);
    return elapsedSeconds >= offset;
  }

  /**
   * Zwraca efektywny stan animacyjny dla danego NPC.
   * Jeżeli od zmiany fazy upłynęło mniej czasu niż indywidualne opóźnienie NPC,
   * postać pozostaje jeszcze w poprzednim stanie (np. kontynuuje słuchanie zamiast natychmiast klaskać).
   */
  getNpcEffectiveState(
    npcId: string | number,
    elapsedSeconds: number,
    minDelay = this.reactionWindow[0],
    maxDelay = this.reactionWindow[1],
  ): ConcertPhase {
    if (this.currentPhase === this.prevPhase) {
      return this.currentPhase;
    }

    const offset = this.getReactionOffset(npcId, minDelay, maxDelay);
    if (elapsedSeconds < offset) {
      return this.prevPhase;
    }
    return this.currentPhase;
  }

  /**
   * Oblicza natężenie entuzjazmu/aplauzu [0.0, 1.0] dla danego NPC,
   * z łagodnym wejściem (attack) po indywidualnym opóźnieniu i wygasaniem (decay).
   */
  getNpcCheerIntensity(npcId: string | number, elapsedSeconds: number, durationSeconds = 6.0): number {
    const offset = this.getReactionOffset(npcId);
    if (elapsedSeconds < offset) {
      return 0;
    }

    const timeSinceReaction = elapsedSeconds - offset;
    const remainingTime = Math.max(0, durationSeconds - elapsedSeconds);

    // Faza ataku: 0.6 sekundy od momentu włączenia się widza
    const attack = Math.min(1.0, timeSinceReaction / 0.6);

    // Faza wygaszania pod koniec trwania aplauzu (ostatnie 1.5 sekundy)
    const decay = remainingTime < 1.5 ? remainingTime / 1.5 : 1.0;

    // Subtelna indywidualna wariancja energii (+/- 10%)
    const energyVariance = 0.9 + sampleNpcRandom(npcId, 17) * 0.2;

    return Math.max(0, Math.min(1.0, attack * decay * energyVariance));
  }

  /**
   * Resetuje stan koncertu do wartości początkowych.
   */
  reset(initialPhase: ConcertPhase = 'idle'): void {
    this.currentPhase = initialPhase;
    this.prevPhase = initialPhase;
    this.currentTrackId = undefined;
    this.phaseStartTimestamp = 0;
  }
}
