import type { EffectId, EffectPhase } from '../effects/EffectManager';
import { voiceAsset } from '../assets/assetManifest';
import catalog from './voiceReactionCatalog.json';

type AudioLike = {
  src: string;
  volume: number;
  currentTime: number;
  play(): Promise<void> | void;
  pause(): void;
};
type AudioFactory = (url: string) => AudioLike;
type Random = () => number;

const effectIds: readonly EffectId[] = ['Piwo', 'Papieros', 'Joint', 'Kreska', 'Grzyb', 'MDMA', 'LSD'];
const tripEffects: readonly EffectId[] = ['Grzyb', 'LSD'];
const nonLightEffects: readonly EffectId[] = ['Joint', 'Kreska', 'Grzyb', 'MDMA', 'LSD'];

export type CampShout = {
  text: string;
  response?: string;
  responseDelay?: number;
};

export const FESTIVAL_CAMP_SHOUTS: readonly CampShout[] = [
  { text: 'Zaraz będzie ciemno!', response: 'ZAMKNIJ SIĘ!', responseDelay: 0.8 },
  { text: 'Pooole! Kurwa, moje pole!' },
  { text: 'Siemankooo!' },
];

export type CampShoutEvent = {
  text: string;
  response?: string;
  position: { x: number; y: number; z: number };
  fromSpeaker: boolean;
};

const defaultAudioFactory: AudioFactory = (url: string) => {
  if (typeof Audio !== 'undefined') return new Audio(url);
  return {
    src: url,
    volume: 1,
    currentTime: 0,
    play: () => Promise.resolve(),
    pause: () => {},
  };
};

export class VoiceReactionManager {
  private foreground: AudioLike;
  private distant: AudioLike;
  private last = '';
  private trackedEffect: EffectId | null = null;
  private rareTripChecked = false;
  private amperRemaining: number;
  private campShoutRemaining: number;
  private lastCampShoutIndex = -1;
  private recentUses: number[] = [];
  private overdoseCooldown = 0;
  private campShoutCallback?: (event: CampShoutEvent) => void;

  constructor(
    private random: Random = Math.random,
    factory: AudioFactory = defaultAudioFactory,
  ) {
    this.foreground = factory('');
    this.distant = factory('');
    this.amperRemaining = this.nextAmperDelay();
    this.campShoutRemaining = this.nextCampShoutDelay();
  }

  /** Ustawia callback wywoływany przy każdym okrzyku obozowym. */
  setCampShoutCallback(callback: (event: CampShoutEvent) => void): void {
    this.campShoutCallback = callback;
  }

  /** Odtwarza losowy lub wybrany festiwalowy okrzyk obozowy z głośnika lub losowej pozycji w obozie. */
  playCampShout(index?: number, sourcePos?: { x: number; y: number; z: number }): CampShoutEvent {
    let shoutIndex: number;
    if (index !== undefined && index >= 0 && index < FESTIVAL_CAMP_SHOUTS.length) {
      shoutIndex = index;
    } else {
      let chosen = Math.floor(this.random() * FESTIVAL_CAMP_SHOUTS.length);
      if (FESTIVAL_CAMP_SHOUTS.length > 1 && chosen === this.lastCampShoutIndex) {
        chosen = (chosen + 1) % FESTIVAL_CAMP_SHOUTS.length;
      }
      shoutIndex = chosen;
    }
    this.lastCampShoutIndex = shoutIndex;
    const shout = FESTIVAL_CAMP_SHOUTS[shoutIndex];

    const fromSpeaker = sourcePos ? false : this.random() < 0.5;
    const position =
      sourcePos ??
      (fromSpeaker
        ? { x: -1.45, y: 0.65, z: 0.65 }
        : {
            x: (this.random() - 0.5) * 20,
            y: 0,
            z: (this.random() - 0.5) * 20,
          });

    const event: CampShoutEvent = {
      text: shout.text,
      response: shout.response,
      position,
      fromSpeaker,
    };

    this.speakCampShout(shout);
    this.campShoutCallback?.(event);
    return event;
  }

  /** Losuje kwestię odtwarzaną przy wejściu do gry. */
  playGameEntry() {
    return this.play(catalog.gameEnter);
  }
  /** Losuje kwestię dla otwarcia albo zamknięcia menu pauzy. */
  playMenuEscape() {
    return this.play(catalog.menuEscape);
  }
  /** Odtwarza reakcję na rozpoczęcie inspekcji przedmiotu. */
  playInspectEnter() {
    return this.play(catalog.inspectEnter);
  }
  /** Odtwarza reakcję na pozostawienie przedmiotu bez użycia. */
  playInspectCancel() {
    return this.play(catalog.inspectCancel);
  }
  /** Odtwarza jednorazową reakcję na pierwszy kontakt z głośnikiem. */
  playFirstSpeaker() {
    return this.play(catalog.firstSpeaker);
  }
  /** Losuje kwestię dla interakcji z toi-toiem. */
  playToilet() {
    return this.play(catalog.toilet);
  }

  /** Rejestruje użycie substancji, losuje reakcję i sprawdza próg przedawkowania. */
  effectStarted(id: EffectId, now = Date.now()) {
    this.trackedEffect = id;
    this.rareTripChecked = false;
    const specific =
      (id in catalog.effectStart ? (catalog.effectStart as Record<string, string[]>)[id] : undefined) ?? [];
    const pool = [...catalog.effectStart.common, ...specific];
    if (nonLightEffects.includes(id)) pool.push(...catalog.effectStart.nonLight);
    this.play(pool);
    this.recentUses = this.recentUses.filter((time) => now - time <= 60_000);
    this.recentUses.push(now);
    if (this.recentUses.length >= 4 && now >= this.overdoseCooldown) {
      this.overdoseCooldown = now + 120_000;
      this.playOverdoseAudio();
    }
  }

  /** Śledzi koniec fazy, rzadkie reakcje tripu oraz okresowe kwestie Ampera. */
  update(dt: number, active: EffectId | null, phase: EffectPhase) {
    if (this.trackedEffect && active === null) {
      this.effectEnded(this.trackedEffect);
      this.trackedEffect = null;
    }
    if (active && this.trackedEffect !== active) {
      this.trackedEffect = active;
      this.rareTripChecked = false;
    }
    if (active && tripEffects.includes(active) && phase === 'active' && !this.rareTripChecked) {
      this.rareTripChecked = true;
      this.play(catalog.midTripRare, 0.1);
    }
    this.amperRemaining -= dt;
    if (this.amperRemaining <= 0) {
      this.play(catalog.amperAmbient);
      this.amperRemaining = this.nextAmperDelay();
    }
    this.campShoutRemaining -= dt;
    if (this.campShoutRemaining <= 0) {
      this.playCampShout();
      this.campShoutRemaining = this.nextCampShoutDelay();
    }
  }

  /** Punkt pod przyszłą animację przedawkowania; głos bliski i cichy głos z oddali są już gotowe. */
  playOverdoseAudio() {
    this.play(catalog.overdose.local);
    this.playOn(this.distant, catalog.overdose.distant, 0.24);
  }
  /** Punkt integracji dla przyszłego efektu wymiotowania. */
  playVomit() {
    return this.play(catalog.future.vomit);
  }

  /** Losuje reakcję właściwą dla końca wskazanego efektu. */
  private effectEnded(id: EffectId) {
    if (id === 'Joint' && this.random() < 0.1) {
      this.play(catalog.jointExitRare);
      return;
    }
    const specific = id in catalog.effectEnd ? catalog.effectEnd[id as keyof typeof catalog.effectEnd] : [];
    this.play([...catalog.effectEnd.common, ...specific]);
  }

  /** Stosuje szansę i odtwarza jeden element puli na głównym kanale. */
  private play(pool: readonly string[], chance = 1) {
    if (!pool.length || this.random() >= chance) return null;
    return this.playOn(this.foreground, pool, 0.82);
  }

  /** Wybiera klip bez natychmiastowego powtórzenia i uruchamia wskazany kanał. */
  private playOn(channel: AudioLike, pool: readonly string[], volume: number) {
    let index = Math.floor(this.random() * pool.length);
    if (pool.length > 1 && pool[index] === this.last) index = (index + 1) % pool.length;
    const name = pool[index];
    this.last = name;
    channel.pause();
    channel.src = voiceAsset(name);
    channel.currentTime = 0;
    channel.volume = volume;
    try {
      Promise.resolve(channel.play()).catch(() => undefined);
    } catch {}
    return name;
  }

  /** Wyznacza następny losowy odstęp między kwestiami Ampera. */
  private nextAmperDelay() {
    return 35 + this.random() * 35;
  }

  /** Wyznacza następny losowy odstęp między okrzykami obozowymi (40-80s). */
  private nextCampShoutDelay() {
    return 40 + this.random() * 40;
  }

  /** Syntetyzuje mowę w języku polskim dla okrzyków obozowych za pomocą Web Speech API. */
  private speakCampShout(shout: CampShout): void {
    if (typeof window === 'undefined' && typeof globalThis === 'undefined') return;
    const synth =
      (typeof window !== 'undefined' ? window.speechSynthesis : undefined) ??
      (typeof globalThis !== 'undefined' ? (globalThis as any).speechSynthesis : undefined);
    const UtteranceClass =
      (typeof window !== 'undefined' ? (window as any).SpeechSynthesisUtterance : undefined) ??
      (typeof globalThis !== 'undefined' ? (globalThis as any).SpeechSynthesisUtterance : undefined);

    if (!synth || !UtteranceClass) return;

    try {
      const u1 = new UtteranceClass(shout.text);
      u1.lang = 'pl-PL';
      u1.pitch = 1.1;
      u1.rate = 1.05;
      u1.volume = 0.95;
      synth.speak(u1);

      if (shout.response) {
        const u2 = new UtteranceClass(shout.response);
        u2.lang = 'pl-PL';
        u2.pitch = 0.85;
        u2.rate = 1.25;
        u2.volume = 1.0;
        const delay = (shout.responseDelay ?? 0.8) * 1000;
        setTimeout(() => {
          try {
            synth.speak(u2);
          } catch {}
        }, delay);
      }
    } catch {}
  }

  /** Zatrzymuje i odłącza oba kanały głosowe oraz syntezę mowy. */
  dispose() {
    for (const audio of [this.foreground, this.distant]) {
      audio.pause();
      audio.src = '';
    }
    const synth =
      (typeof window !== 'undefined' ? window.speechSynthesis : undefined) ??
      (typeof globalThis !== 'undefined' ? (globalThis as any).speechSynthesis : undefined);
    if (synth && typeof synth.cancel === 'function') {
      try {
        synth.cancel();
      } catch {}
    }
  }
}

/** Zbiera unikalne nazwy WAV z całego katalogu do testów i walidacji. */
export const allVoiceReactionNames = () => {
  const names = new Set<string>();
  /** Rekurencyjnie przechodzi po katalogu i dodaje napotkane nazwy nagrań. */
  const visit = (value: unknown) => {
    if (typeof value === 'string') names.add(value);
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') Object.values(value).forEach(visit);
  };
  visit(catalog);
  return [...names];
};

export const supportedVoiceEffects = effectIds;
