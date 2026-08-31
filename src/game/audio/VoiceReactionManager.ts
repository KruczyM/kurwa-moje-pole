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

export class VoiceReactionManager {
  private foreground: AudioLike;
  private distant: AudioLike;
  private last = '';
  private trackedEffect: EffectId | null = null;
  private rareTripChecked = false;
  private amperRemaining: number;
  private recentUses: number[] = [];
  private overdoseCooldown = 0;

  constructor(
    private random: Random = Math.random,
    factory: AudioFactory = (url) => new Audio(url),
  ) {
    this.foreground = factory('');
    this.distant = factory('');
    this.amperRemaining = this.nextAmperDelay();
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
    const pool = [...catalog.effectStart.common, ...catalog.effectStart[id]];
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
  /** Zatrzymuje i odłącza oba kanały głosowe. */
  dispose() {
    for (const audio of [this.foreground, this.distant]) {
      audio.pause();
      audio.src = '';
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
