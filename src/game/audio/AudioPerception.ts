import type { EffectId } from '../effects/EffectManager';

export interface PerceptionParameters {
  cutoff: number;
  echo: number;
  delay: number;
  gain: number;
}
const profiles: Partial<Record<EffectId, [number, number, number, number]>> = {
  Piwo: [6500, 0.04, 0.12, 0.94],
  Joint: [5200, 0.1, 0.19, 0.94],
  Grzyb: [10000, 0.19, 0.24, 0.9],
  LSD: [12500, 0.23, 0.3, 0.88],
  MDMA: [16500, 0.08, 0.12, 0.96],
  Kreska: [18500, 0.025, 0.07, 0.98],
  Papieros: [19000, 0, 0.12, 0.99],
};
/** Artistic cues, not a physiological simulation. Never amplifies the source. */
export function audioPerceptionAt(
  effect: EffectId | null,
  intensity: number,
  time: number,
  reduceMotion = false,
): PerceptionParameters {
  const profile = effect ? profiles[effect] : undefined;
  const level = profile && Number.isFinite(intensity) ? Math.max(0, Math.min(1, intensity)) : 0;
  const [cutoff, echo, delay, gain] = profile ?? [20000, 0, 0.12, 1];
  const psychedelic = effect === 'Grzyb' || effect === 'LSD';
  const wobble = psychedelic && !reduceMotion && Number.isFinite(time) ? Math.sin(time * 0.8) : 0;
  return {
    cutoff: 20000 + (cutoff - 20000 + wobble * 900) * level,
    echo: echo * level,
    delay: delay + wobble * 0.018 * level,
    gain: 1 + (gain - 1) * level,
  };
}

/** Insert into an existing audio route; no timers, oscillators or feedback loops. */
export class AudioPerceptionGraph {
  readonly input: BiquadFilterNode;
  readonly output: GainNode;
  private dry: GainNode;
  private wet: GainNode;
  private delay: DelayNode;
  constructor(private context: AudioContext) {
    this.input = context.createBiquadFilter();
    this.input.type = 'lowpass';
    this.input.Q.value = 0.707;
    this.input.frequency.value = 20000;
    this.output = context.createGain();
    this.dry = context.createGain();
    this.wet = context.createGain();
    this.wet.gain.value = 0;
    this.delay = context.createDelay(0.5);
    this.delay.delayTime.value = 0.12;
    this.input.connect(this.dry);
    this.dry.connect(this.output);
    this.input.connect(this.delay);
    this.delay.connect(this.wet);
    this.wet.connect(this.output);
  }
  update(p: PerceptionParameters): void {
    const t = this.context.currentTime;
    this.input.frequency.setTargetAtTime(p.cutoff, t, 0.12);
    this.delay.delayTime.setTargetAtTime(p.delay, t, 0.15);
    // Convex dry/wet mix keeps peak gain <= original even for correlated samples.
    this.dry.gain.setTargetAtTime(1 - p.echo, t, 0.12);
    this.wet.gain.setTargetAtTime(p.echo, t, 0.12);
    this.output.gain.setTargetAtTime(p.gain, t, 0.12);
  }
  dispose(): void {
    for (const node of [this.input, this.output, this.dry, this.wet, this.delay]) node.disconnect();
  }
}
