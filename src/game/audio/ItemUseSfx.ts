import type { ItemUseSfxId } from '../interactions/itemUseSequenceConfig';

export type ItemUseSfxOptions = {
  audioContext?: AudioContext;
  defaultVolume?: number;
};

export const DEFAULT_ITEM_USE_SFX_VOLUME = 0.85;

/**
 * Proceduralny generator efektów dźwiękowych (SFX) użycia przedmiotów oparty na Web Audio API.
 * Syntetyzuje dźwięki:
 * - beer_open: klik zawleczki + syk uchodzącego gazu z puszki
 * - lighter_flick: pstryknięcie krzesiwa zapalniczki + krótki szum gazu
 * - sniff: wciągnięcie powietrza / kreski
 * - swallow: przełknięcie tabletki / grzyba
 */
export class ItemUseSfxPlayer {
  private ctx: AudioContext | null = null;
  private userVolume: number;
  private disposed = false;

  constructor(options: ItemUseSfxOptions = {}) {
    this.userVolume = Math.min(1, Math.max(0, options.defaultVolume ?? DEFAULT_ITEM_USE_SFX_VOLUME));
    if (options.audioContext) {
      this.ctx = options.audioContext;
    }
  }

  /** Zwraca aktualną głośność efektów (0..1). */
  get volume(): number {
    return this.userVolume;
  }

  /** Ustawia głośność efektów (0..1). */
  setVolume(volume: number): void {
    this.userVolume = Math.min(1, Math.max(0, volume));
  }

  /** Odtwarza proceduralny dźwięk dla danego identyfikatora SFX. */
  play(sound: ItemUseSfxId | string, volumeModifier = 1.0): boolean {
    if (this.disposed || this.userVolume <= 0) return false;
    if (!this.initContext() || !this.ctx) return false;

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }

    const finalVolume = this.userVolume * Math.max(0, Math.min(2, volumeModifier));
    try {
      switch (sound) {
        case 'beer_open':
          return this.synthesizeBeerOpen(finalVolume);
        case 'lighter_flick':
          return this.synthesizeLighterFlick(finalVolume);
        case 'sniff':
          return this.synthesizeSniff(finalVolume);
        case 'swallow':
          return this.synthesizeSwallow(finalVolume);
        default:
          return false;
      }
    } catch {
      return false;
    }
  }

  private initContext(): boolean {
    if (this.ctx) return true;
    if (typeof window === 'undefined') return false;
    const AudioCtxClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtxClass) return false;
    try {
      this.ctx = new AudioCtxClass();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Puszka piwa: ostry, metaliczny klik otwarcia zawleczki i dynamiczny,
   * opadający syk gazu CO2 pod ciśnieniem (pssst!).
   */
  private synthesizeBeerOpen(vol: number): boolean {
    if (!this.ctx) return false;
    const now = this.ctx.currentTime;
    const sampleRate = this.ctx.sampleRate || 44100;

    // 1. Metaliczny trzask zawleczki (krótki impuls o opadającej częstotliwości)
    const clickOsc = this.ctx.createOscillator();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(820, now);
    clickOsc.frequency.exponentialRampToValueAtTime(180, now + 0.035);

    const clickGain = this.ctx.createGain();
    clickGain.gain.setValueAtTime(0.7 * vol, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    clickOsc.connect(clickGain);
    clickGain.connect(this.ctx.destination);
    clickOsc.start(now);
    clickOsc.stop(now + 0.045);

    // 2. Szum uchodzącego gazu (wysokotonowy syk pssssst!)
    const hissDuration = 0.38;
    const bufferSize = Math.floor(sampleRate * hissDuration);
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const hissSource = this.ctx.createBufferSource();
    hissSource.buffer = noiseBuffer;

    const highpass = this.ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(2800, now);

    const peaking = this.ctx.createBiquadFilter();
    peaking.type = 'peaking';
    peaking.frequency.setValueAtTime(5200, now);
    peaking.gain.setValueAtTime(6.0, now);

    const hissGain = this.ctx.createGain();
    // Syk pojawia się ułamek sekundy po kliknięciu
    hissGain.gain.setValueAtTime(0.001, now);
    hissGain.gain.setValueAtTime(0.6 * vol, now + 0.012);
    hissGain.gain.exponentialRampToValueAtTime(0.001, now + hissDuration);

    hissSource.connect(highpass);
    highpass.connect(peaking);
    peaking.connect(hissGain);
    hissGain.connect(this.ctx.destination);

    hissSource.start(now);
    hissSource.stop(now + hissDuration);
    return true;
  }

  /**
   * Zapalniczka: twarde uderzenie kółka krzesiwa w kamień (dwa szybkie mikro-impulsy)
   * oraz cichy, miękki szum wypływającego gazu.
   */
  private synthesizeLighterFlick(vol: number): boolean {
    if (!this.ctx) return false;
    const now = this.ctx.currentTime;
    const sampleRate = this.ctx.sampleRate || 44100;

    // 1. Dwa szybkie mikro-kliki krzesiwa
    const clickDuration = 0.025;
    const bufferSize = Math.floor(sampleRate * clickDuration);
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const clickSource1 = this.ctx.createBufferSource();
    clickSource1.buffer = noiseBuffer;
    const bandpass = this.ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(3200, now);
    bandpass.Q.setValueAtTime(2.5, now);

    const clickGain = this.ctx.createGain();
    clickGain.gain.setValueAtTime(0.75 * vol, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

    clickSource1.connect(bandpass);
    bandpass.connect(clickGain);
    clickGain.connect(this.ctx.destination);
    clickSource1.start(now);

    // 2. Krótki, cichy szum gazu z palnika
    const gasDuration = 0.22;
    const gasBuffer = this.ctx.createBuffer(1, Math.floor(sampleRate * gasDuration), sampleRate);
    const gasData = gasBuffer.getChannelData(0);
    for (let i = 0; i < gasData.length; i++) {
      gasData[i] = (Math.random() * 2 - 1) * 0.3;
    }

    const gasSource = this.ctx.createBufferSource();
    gasSource.buffer = gasBuffer;

    const gasFilter = this.ctx.createBiquadFilter();
    gasFilter.type = 'lowpass';
    gasFilter.frequency.setValueAtTime(1800, now);

    const gasGain = this.ctx.createGain();
    gasGain.gain.setValueAtTime(0.001, now);
    gasGain.gain.setValueAtTime(0.25 * vol, now + 0.02);
    gasGain.gain.exponentialRampToValueAtTime(0.001, now + gasDuration);

    gasSource.connect(gasFilter);
    gasFilter.connect(gasGain);
    gasGain.connect(this.ctx.destination);
    gasSource.start(now + 0.015);
    return true;
  }

  /**
   * Wciągnięcie (kreska): dynamiczne zasysanie powietrza przez nos
   * (filtr pasmowo-przepustowy z narastającym atakiem i gładkim zanikiem).
   */
  private synthesizeSniff(vol: number): boolean {
    if (!this.ctx) return false;
    const now = this.ctx.currentTime;
    const sampleRate = this.ctx.sampleRate || 44100;
    const duration = 0.24;

    const buffer = this.ctx.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(950, now);
    filter.frequency.linearRampToValueAtTime(1450, now + 0.12);
    filter.Q.setValueAtTime(1.8, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.55 * vol, now + 0.07);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    source.start(now);
    return true;
  }

  /**
   * Połknięcie (MDMA, LSD, Grzyb): delikatny rezonans gardłowy / gulp.
   */
  private synthesizeSwallow(vol: number): boolean {
    if (!this.ctx) return false;
    const now = this.ctx.currentTime;
    const duration = 0.11;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.45 * vol, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.01);
    return true;
  }

  /** Zwalnia zasoby i odłącza AudioContext. */
  dispose(): void {
    this.disposed = true;
    if (this.ctx && typeof this.ctx.close === 'function') {
      void this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
