import { distanceToGrzybek } from '../world/festivalGrzybek';

export const GRZYBEK_AUDIO_CONFIG = {
  innerRadius: 4.0,
  maxRadius: 28.0,
  baseVolume: 0.85,
} as const;

export function calculateGrzybekSpatialGain(
  distance: number,
  innerRadius: number = GRZYBEK_AUDIO_CONFIG.innerRadius,
  maxRadius: number = GRZYBEK_AUDIO_CONFIG.maxRadius,
): number {
  if (distance <= innerRadius) return 1.0;
  if (distance >= maxRadius) return 0.0;
  const t = 1.0 - (distance - innerRadius) / (maxRadius - innerRadius);
  return t * t;
}

export class GrzybekWaterAudio {
  private context: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private noiseSource: AudioBufferSourceNode | null = null;
  private muted = false;
  private isPlaying = false;
  private isPaused = false;
  private userVolume = 1.0;
  private pendingGestureResume: (() => void) | null = null;

  constructor(context?: AudioContext) {
    if (context) {
      this.init(context);
    }
  }

  public init(context?: AudioContext): void {
    if (this.context) return;
    if (!context) {
      if (typeof window === 'undefined') return;
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxClass) return;
      try {
        context = new AudioCtxClass();
      } catch {
        return;
      }
    }
    this.context = context;

    const sampleRate = context.sampleRate || 44100;
    const duration = 2.0;
    const bufferSize = Math.floor(sampleRate * duration);
    const buffer = context.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);

    let b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0,
      b4 = 0,
      b5 = 0,
      b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      b6 = white * 0.115926;
      data[i] = pink * 0.12;
    }

    const highpass = context.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 280;

    const bandpass = context.createBiquadFilter();
    bandpass.type = 'peaking';
    bandpass.frequency.value = 1650;
    bandpass.Q.value = 1.1;
    bandpass.gain.value = 6.0;

    const lowpass = context.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 4500;

    this.gainNode = context.createGain();
    this.gainNode.gain.value = 0.0;

    this.noiseSource = context.createBufferSource();
    this.noiseSource.buffer = buffer;
    this.noiseSource.loop = true;

    this.noiseSource.connect(highpass);
    highpass.connect(bandpass);
    bandpass.connect(lowpass);
    lowpass.connect(this.gainNode);
    this.gainNode.connect(context.destination);

    try {
      this.noiseSource.start(0);
      this.isPlaying = true;
    } catch {
      // AudioContext may need user gesture
    }

    if (this.context.state === 'suspended') {
      this.setupGestureResume();
    }
  }

  private setupGestureResume(): void {
    if (typeof window === 'undefined') return;
    this.clearGestureListener();

    const onGesture = () => {
      this.clearGestureListener();
      if (this.context && this.context.state === 'suspended') {
        void this.context.resume();
      }
    };

    this.pendingGestureResume = onGesture;
    window.addEventListener('pointerdown', onGesture, { once: true, capture: true });
    window.addEventListener('keydown', onGesture, { once: true, capture: true });
  }

  private clearGestureListener(): void {
    if (typeof window !== 'undefined' && this.pendingGestureResume) {
      window.removeEventListener('pointerdown', this.pendingGestureResume, { capture: true });
      window.removeEventListener('keydown', this.pendingGestureResume, { capture: true });
    }
    this.pendingGestureResume = null;
  }

  public setVolume(volume: number): void {
    this.userVolume = Math.min(1, Math.max(0, volume));
  }

  public pause(): void {
    this.isPaused = true;
    if (this.gainNode && this.context) {
      this.gainNode.gain.setTargetAtTime(0, this.context.currentTime, 0.05);
    }
  }

  public resume(): void {
    this.isPaused = false;
    if (this.context && this.context.state === 'suspended') {
      void this.context.resume();
    }
  }

  public update(playerX: number, playerZ: number): void {
    if (!this.gainNode || !this.context) return;
    if (this.muted || this.isPaused || this.userVolume <= 0) {
      this.gainNode.gain.setTargetAtTime(0, this.context.currentTime, 0.05);
      return;
    }
    const dist = distanceToGrzybek(playerX, playerZ);
    const spatial = calculateGrzybekSpatialGain(dist);
    const targetGain = spatial * GRZYBEK_AUDIO_CONFIG.baseVolume * this.userVolume;
    this.gainNode.gain.setTargetAtTime(targetGain, this.context.currentTime, 0.1);
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.gainNode && this.context && muted) {
      this.gainNode.gain.setValueAtTime(0, this.context.currentTime);
    }
  }

  public dispose(): void {
    this.clearGestureListener();
    if (this.noiseSource && this.isPlaying) {
      try {
        this.noiseSource.stop();
      } catch {
        // Ignore
      }
      this.noiseSource.disconnect();
    }
    if (this.gainNode) {
      this.gainNode.disconnect();
    }
    this.isPlaying = false;
  }
}
