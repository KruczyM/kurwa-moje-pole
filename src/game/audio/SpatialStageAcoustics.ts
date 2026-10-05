/**
 * SpatialStageAcoustics — Dźwięk przestrzenny Dużej Sceny (E2)
 *
 * Implementuje dwugałęziowy model akustyczny Dużej Sceny festiwalowej:
 * - Gałąź sucha (Dry): blisko sceny -> pełna dynamika, krystaliczne pasmo (20 kHz), stereofoniczny panner.
 * - Gałąź mokra (Wet): dalekie pole / obozy -> filtr dolnoprzepustowy (spadek do 400 Hz),
 *   subtelne opóźnienie/echo odbić polowych, płynne wygaszanie z całkowitą ciszą powyżej 300 m.
 *
 * Czyste funkcje matematyczne są w 100% deterministyczne i niezależne od środowiska przeglądarkowego.
 * Klasa integrująca Web Audio API umożliwia płynne sterowanie węzłami bez trzasków i zniekształceń.
 */

import { FESTIVAL_STAGE_SITES } from '../world/festivalStages';
import { AudioPerceptionGraph, type PerceptionParameters } from './AudioPerception';

export interface Vector3Like {
  readonly x: number;
  readonly y?: number;
  readonly z: number;
}

export interface AcousticParameters {
  /** Odległość euklidesowa w metrach */
  readonly distanceMeters: number;
  /** Wzmocnienie sygnału bezpośredniego [0.0 .. 1.0] */
  readonly dryGain: number;
  /** Wzmocnienie pogłosu i odbić polowych [0.0 .. 1.0] */
  readonly wetGain: number;
  /** Częstotliwość odcięcia filtru dolnoprzepustowego w Hz [400 .. 20000] */
  readonly lowpassCutoffHz: number;
  /** Opóźnienie odbić w milisekundach */
  readonly reverbDelayMs: number;
}

export interface SpatialStageAcousticsOptions {
  /** Opcjonalna niestandardowa pozycja sceny (domyślnie z FESTIVAL_STAGE_SITES dla 'mainStage') */
  readonly stagePosition?: Vector3Like;
  /** Referencja do kontekstu Web Audio API (opcjonalna) */
  readonly audioContext?: AudioContext;
  /** Domyślna głośność użytkownika [0.0 .. 1.0] */
  readonly userVolume?: number;
  /** Maksymalny zasięg słyszalności w metrach (domyślnie 300.0) */
  readonly maxAudibleDistance?: number;
}

/**
 * Pozycja Dużej Sceny pobrana z oficjalnego rejestru festiwalowego `festivalStages.ts`.
 */
const mainStageSite = FESTIVAL_STAGE_SITES.find((s) => s.id === 'mainStage');
export const DEFAULT_MAIN_STAGE_POSITION: Vector3Like = {
  x: mainStageSite?.x ?? 216,
  y: 0,
  z: mainStageSite?.z ?? 18,
};

/**
 * Alternatywne współrzędne Dużej Sceny z planu projektowego (X: 0, Z: -180).
 */
export const PROMPT_STAGE_POSITION: Vector3Like = {
  x: 0,
  y: 0,
  z: -180,
};

/**
 * Funkcja wygładzająca Smoothstep: 3u^2 - 2u^3 dla u w zakresie [0, 1].
 */
export function smoothstep(u: number): number {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  return u * u * (3 - 2 * u);
}

/**
 * Oblicza odległość euklidesową 3D pomiędzy słuchaczem a sceną.
 */
export function calculateDistanceToStage(
  listenerPos: Vector3Like,
  stagePos: Vector3Like = DEFAULT_MAIN_STAGE_POSITION,
): number {
  const dx = listenerPos.x - stagePos.x;
  const dy = (listenerPos.y ?? 0) - (stagePos.y ?? 0);
  const dz = listenerPos.z - stagePos.z;
  return Math.hypot(dx, dy, dz);
}

/**
 * Oblicza odległość 2D na płaszczyźnie poziomej (XZ) pomiędzy słuchaczem a sceną.
 */
export function calculateHorizontalDistanceToStage(
  listenerPos: Vector3Like,
  stagePos: Vector3Like = DEFAULT_MAIN_STAGE_POSITION,
): number {
  const dx = listenerPos.x - stagePos.x;
  const dz = listenerPos.z - stagePos.z;
  return Math.hypot(dx, dz);
}

/**
 * Czysta funkcja matematyczna wyznaczająca parametry akustyczne na podstawie odległości.
 *
 * Krzywa akustyczna:
 * - 0 .. 40m: bezpośrednio pod sceną -> dryGain ~ 1.0, lowpassCutoff ~ 20000Hz, wetGain ~ 0.05
 * - 40 .. 120m: pole koncertowe -> płynny spadek dryGain do ~0.35, cutoff spada do 5000Hz, wetGain ~ 0.15
 * - 120 .. 250m: strefa obozów i młyna -> dryGain spada do ~0.10, cutoff spada do 800Hz (przytłumiony bas), wetGain ~ 0.20
 * - 250 .. 300m: granica słyszalności -> dryGain wygaszany do 0.0, wetGain wygaszany do 0.0, cutoff spada do 400Hz
 * - > 300m: całkowita cisza -> dryGain = 0.0, wetGain = 0.0, cutoff = 400Hz
 *
 * Wszystkie parametry są monotoniczne, ograniczone i odporne na przesterowania (limiter-safe).
 */
export function calculateAcoustics(distanceMeters: number): AcousticParameters {
  if (Number.isNaN(distanceMeters) || distanceMeters < 0) {
    distanceMeters = 0;
  }

  if (!Number.isFinite(distanceMeters)) {
    return {
      distanceMeters: Infinity,
      dryGain: 0.0,
      wetGain: 0.0,
      lowpassCutoffHz: 400,
      reverbDelayMs: 130,
    };
  }

  let dryGain: number;
  let wetGain: number;
  let lowpassCutoffHz: number;
  let reverbDelayMs: number;

  if (distanceMeters <= 40) {
    // 0 .. 40m: Front sceny, krystaliczny pełny dźwięk
    dryGain = 1.0;
    wetGain = 0.05;
    lowpassCutoffHz = 20000;
    reverbDelayMs = 25;
  } else if (distanceMeters <= 120) {
    // 40 .. 120m: Pole koncertowe
    const u = (distanceMeters - 40) / (120 - 40);
    const s = smoothstep(u);

    // dryGain płynnie opada od 1.0 do 0.35
    dryGain = 1.0 - s * (1.0 - 0.35);
    // cutoff opada od 20000 Hz do 5000 Hz
    lowpassCutoffHz = 20000 - s * (20000 - 5000);
    // wetGain rośnie od 0.05 do 0.15
    wetGain = 0.05 + s * (0.15 - 0.05);
    // delay rośnie od 25 ms do 65 ms
    reverbDelayMs = 25 + s * (65 - 25);
  } else if (distanceMeters <= 250) {
    // 120 .. 250m: Obozy namiotowe / diabelski młyn
    const u = (distanceMeters - 120) / (250 - 120);
    const s = smoothstep(u);

    // dryGain opada od 0.35 do 0.10
    dryGain = 0.35 - s * (0.35 - 0.1);
    // cutoff opada od 5000 Hz do 800 Hz (przytłumione basy)
    lowpassCutoffHz = 5000 - s * (5000 - 800);
    // wetGain rośnie od 0.15 do 0.20
    wetGain = 0.15 + s * (0.2 - 0.15);
    // delay rośnie od 65 ms do 110 ms
    reverbDelayMs = 65 + s * (110 - 65);
  } else if (distanceMeters <= 300) {
    // 250 .. 300m: Wygaszanie dźwięku do absolutnej ciszy
    const u = (distanceMeters - 250) / (300 - 250);
    const s = smoothstep(u);

    // dryGain opada od 0.10 do 0.00
    dryGain = 0.1 * (1 - s);
    // cutoff opada od 800 Hz do 400 Hz
    lowpassCutoffHz = 800 - s * (800 - 400);
    // wetGain opada od 0.20 do 0.00
    wetGain = 0.2 * (1 - s);
    // delay dociera do 130 ms
    reverbDelayMs = 110 + s * (130 - 110);
  } else {
    // > 300m: Pełna cisza
    dryGain = 0.0;
    wetGain = 0.0;
    lowpassCutoffHz = 400;
    reverbDelayMs = 130;
  }

  // Zabezpieczenie przed przesterem i wartościami spoza zakresu [0.0, 1.0]
  dryGain = Math.min(1.0, Math.max(0.0, dryGain));
  wetGain = Math.min(1.0, Math.max(0.0, wetGain));
  lowpassCutoffHz = Math.min(20000, Math.max(400, lowpassCutoffHz));

  return {
    distanceMeters,
    dryGain,
    wetGain,
    lowpassCutoffHz,
    reverbDelayMs,
  };
}

/**
 * Oblicza pozycję panoramy stereofonicznej [-1.0 .. +1.0] na podstawie kąta patrzenia słuchacza i pozycji sceny.
 * -1.0 = scena po lewej, 0.0 = scena na wprost, +1.0 = scena po prawej.
 */
export function calculateStageStereoPan(
  listenerPos: Vector3Like,
  listenerYawRad: number,
  stagePos: Vector3Like = DEFAULT_MAIN_STAGE_POSITION,
): number {
  const dx = stagePos.x - listenerPos.x;
  const dz = stagePos.z - listenerPos.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.1) return 0.0;

  // Kąt w świecie do sceny (0 rad = w stronę -Z północy, Pi/2 rad = +X wschód)
  const angleToStage = Math.atan2(dx, -dz);
  // Różnica kątowa względem obrotu głowy słuchacza
  const relativeAngle = angleToStage - listenerYawRad;

  // Sinus kąta relatywnego wyznacza przesunięcie stereo lewo/prawo
  const pan = Math.sin(relativeAngle);
  return Math.min(1.0, Math.max(-1.0, pan));
}

/**
 * Klasa pomocnicza zarządzająca dwugałęziowym grafem węzłów Web Audio API:
 *
 *           ┌──> Dry Lowpass Filter ──> Dry Gain Node ──> Stereo Panner ──┐
 * Source ───┤                                                             ├──> Master Gain ──> Destination
 *           └──> Wet Lowpass Filter ──> Delay Node ─────> Wet Gain Node ──┘
 */
export class SpatialStageAcousticsGraph {
  private ctx: AudioContext | null = null;
  private stagePos: Vector3Like;
  private userVolume = 1.0;

  // Węzły audio
  public inputNode: GainNode | null = null;
  public masterGain: GainNode | null = null;
  private perception?: AudioPerceptionGraph;
  private perceptionParameters?: PerceptionParameters;
  setPerception(parameters: PerceptionParameters): void {
    this.perceptionParameters = parameters;
    this.perception?.update(parameters);
  }
  connectOutput(destination: AudioNode): void {
    if (!this.ctx || !this.masterGain) return;
    this.perception ??= new AudioPerceptionGraph(this.ctx);
    this.masterGain.connect(this.perception.input);
    this.perception.output.connect(destination);
    if (this.perceptionParameters) this.perception.update(this.perceptionParameters);
  }

  // Gałąź sucha (Dry)
  public dryFilter: BiquadFilterNode | null = null;
  public dryGainNode: GainNode | null = null;
  public pannerNode: StereoPannerNode | null = null;

  // Gałąź mokra (Wet)
  public wetFilter: BiquadFilterNode | null = null;
  public delayNode: DelayNode | null = null;
  public wetGainNode: GainNode | null = null;

  private lastParams: AcousticParameters = calculateAcoustics(0);
  private disposed = false;

  constructor(options: SpatialStageAcousticsOptions = {}) {
    this.stagePos = options.stagePosition ?? DEFAULT_MAIN_STAGE_POSITION;
    this.userVolume = Math.min(1, Math.max(0, options.userVolume ?? 1.0));

    if (options.audioContext) {
      this.initGraph(options.audioContext);
    }
  }

  /**
   * Zwraca aktualnie używaną pozycję sceny.
   */
  get stagePosition(): Vector3Like {
    return this.stagePos;
  }
  setStagePosition(position: Vector3Like): void {
    this.stagePos = { x: position.x, y: position.y ?? 0, z: position.z };
  }

  /**
   * Pobiera ostatnio obliczone parametry akustyczne.
   */
  get currentParameters(): AcousticParameters {
    return this.lastParams;
  }

  /**
   * Inicjalizuje węzły Web Audio API.
   */
  public initGraph(audioContext: AudioContext): boolean {
    if (this.disposed) return false;
    this.ctx = audioContext;

    try {
      this.inputNode = this.ctx.createGain();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.userVolume;

      // Gałąź A (Dry)
      this.dryFilter = this.ctx.createBiquadFilter();
      this.dryFilter.type = 'lowpass';
      this.dryFilter.frequency.value = 20000;
      this.dryFilter.Q.value = 0.707; // Płaski spadek Butterwortha

      this.dryGainNode = this.ctx.createGain();
      this.dryGainNode.gain.value = 1.0;

      if (typeof this.ctx.createStereoPanner === 'function') {
        this.pannerNode = this.ctx.createStereoPanner();
        this.pannerNode.pan.value = 0.0;
      }

      // Gałąź B (Wet)
      this.wetFilter = this.ctx.createBiquadFilter();
      this.wetFilter.type = 'lowpass';
      this.wetFilter.frequency.value = 20000;
      this.wetFilter.Q.value = 1.0;

      this.delayNode = this.ctx.createDelay(0.5); // Maks. 500 ms bufora opóźnienia
      this.delayNode.delayTime.value = 0.025; // 25 ms startowe

      this.wetGainNode = this.ctx.createGain();
      this.wetGainNode.gain.value = 0.05;

      // Łączenie toru gałęzi suchej:
      // input -> dryFilter -> dryGainNode -> (panner) -> masterGain
      this.inputNode.connect(this.dryFilter);
      this.dryFilter.connect(this.dryGainNode);

      if (this.pannerNode) {
        this.dryGainNode.connect(this.pannerNode);
        this.pannerNode.connect(this.masterGain);
      } else {
        this.dryGainNode.connect(this.masterGain);
      }

      // Łączenie toru gałęzi mokrej:
      // input -> wetFilter -> delayNode -> wetGainNode -> masterGain
      this.inputNode.connect(this.wetFilter);
      this.wetFilter.connect(this.delayNode);
      this.delayNode.connect(this.wetGainNode);
      this.wetGainNode.connect(this.masterGain);

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Ustawia poziom suwaka głośności użytkownika.
   */
  setUserVolume(volume: number) {
    this.userVolume = Math.min(1, Math.max(0, volume));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.userVolume, this.ctx.currentTime, 0.03);
    }
  }

  /**
   * Pobiera aktualny poziom suwaka głośności.
   */
  getUserVolume(): number {
    return this.userVolume;
  }

  /**
   * Aktualizuje parametry akustyczne na podstawie pozycji i orientacji słuchacza.
   * Używa bezpiecznego wykładniczego przejścia czasowego (setTargetAtTime), zapobiegając trzaskom.
   *
   * @param listenerPos Pozycja gracza w świecie
   * @param listenerYawRad Kąt obrotu kamery/głowy gracza w radianach
   * @param rampTimeSec Czas wygładzania w sekundach (domyślnie 0.04s)
   */
  update(
    listenerPos: Vector3Like,
    listenerYawRad: number = 0,
    rampTimeSec: number = 0.04,
  ): AcousticParameters {
    if (this.disposed) return this.lastParams;

    const distance = calculateDistanceToStage(listenerPos, this.stagePos);
    const params = calculateAcoustics(distance);
    this.lastParams = params;

    const pan = calculateStageStereoPan(listenerPos, listenerYawRad, this.stagePos);

    if (this.ctx && this.ctx.state !== 'closed') {
      const time = this.ctx.currentTime;
      const tc = Math.max(0.005, rampTimeSec);

      // Gałąź sucha
      if (this.dryGainNode) {
        this.dryGainNode.gain.setTargetAtTime(params.dryGain, time, tc);
      }
      if (this.dryFilter) {
        this.dryFilter.frequency.setTargetAtTime(params.lowpassCutoffHz, time, tc);
      }
      if (this.pannerNode) {
        this.pannerNode.pan.setTargetAtTime(pan, time, tc);
      }

      // Gałąź mokra
      if (this.wetGainNode) {
        this.wetGainNode.gain.setTargetAtTime(params.wetGain, time, tc);
      }
      if (this.wetFilter) {
        this.wetFilter.frequency.setTargetAtTime(params.lowpassCutoffHz, time, tc);
      }
      if (this.delayNode) {
        this.delayNode.delayTime.setTargetAtTime(params.reverbDelayMs / 1000, time, tc);
      }
    }

    return params;
  }

  /**
   * Rozłącza wszystkie węzły i zwalnia zasoby audio.
   */
  dispose() {
    this.disposed = true;
    this.perception?.dispose();

    try {
      this.inputNode?.disconnect();
      this.dryFilter?.disconnect();
      this.dryGainNode?.disconnect();
      this.pannerNode?.disconnect();
      this.wetFilter?.disconnect();
      this.delayNode?.disconnect();
      this.wetGainNode?.disconnect();
      this.masterGain?.disconnect();
    } catch {}

    this.inputNode = null;
    this.dryFilter = null;
    this.dryGainNode = null;
    this.pannerNode = null;
    this.wetFilter = null;
    this.delayNode = null;
    this.wetGainNode = null;
    this.masterGain = null;
    this.ctx = null;
  }
}

export { SpatialStageAcousticsGraph as SpatialStageAcoustics };
