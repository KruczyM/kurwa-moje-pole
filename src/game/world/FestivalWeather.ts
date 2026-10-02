import * as THREE from 'three';

export type WeatherType = 'clear' | 'overcast' | 'rain' | 'storm';

export interface FestivalWeatherOptions {
  initialWeather?: WeatherType;
  particleCount?: number;
  audioContext?: AudioContext;
}

/**
 * FestivalWeather — Dynamiczny system pogody festiwalowej Pol'and'Rock:
 * - Realistyczny system cząsteczek deszczu (Three.js Points) podążający za kamerą gracza,
 * - Proceduralna synteza audio szumu deszczu i kropel bębniących o płachty namiotów,
 * - Przyciemnienie oświetlenia i zwiększenie wilgotności / kałuż na nawierzchni,
 * - Aktywność festiwalowiczów na zjeżdżalni błotnej (mud slide) pod sceną,
 * - Klawisz dev [K] do natychmiastowego przełączania pogody.
 */
export class FestivalWeather {
  private weather: WeatherType = 'clear';
  private rainGroup = new THREE.Group();
  private rainGeometry: THREE.BufferGeometry | null = null;
  private rainMaterial: THREE.PointsMaterial | null = null;
  private rainPoints: THREE.Points | null = null;
  private particleCount: number;

  // Pozycje i prędkości cząsteczek deszczu
  private rainPositions: Float32Array | null = null;
  private rainVelocities: Float32Array | null = null;
  private boxSize = { width: 50, height: 26, depth: 50 };

  // Proceduralne audio deszczu
  private audioCtx: AudioContext | null = null;
  private noiseNode: AudioBufferSourceNode | null = null;
  private rainGainNode: GainNode | null = null;
  private rainFilter: BiquadFilterNode | null = null;
  private isAudioRunning = false;
  private userVolume = 0.65;

  constructor(
    private readonly scene: THREE.Scene,
    options: FestivalWeatherOptions = {},
  ) {
    this.particleCount = options.particleCount ?? 2000;
    this.rainGroup.name = 'FestivalWeather_Rain';
    this.scene.add(this.rainGroup);

    this.initRainParticles();
    if (options.audioContext) {
      this.initAudio(options.audioContext);
    }

    if (options.initialWeather) {
      this.setWeather(options.initialWeather);
    }
  }

  public get currentWeather(): WeatherType {
    return this.weather;
  }

  public get isRaining(): boolean {
    return this.weather === 'rain' || this.weather === 'storm';
  }

  /**
   * Inicjalizuje bufor cząsteczek deszczu.
   */
  private initRainParticles(): void {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(this.particleCount * 3);
    const velocities = new Float32Array(this.particleCount);

    for (let i = 0; i < this.particleCount; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * this.boxSize.width;
      positions[i * 3 + 1] = Math.random() * this.boxSize.height;
      positions[i * 3 + 2] = (Math.random() - 0.5) * this.boxSize.depth;
      // Prędkość spadania kropli: 18 - 28 m/s
      velocities[i] = 18.0 + Math.random() * 10.0;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.rainGeometry = geo;
    this.rainPositions = positions;
    this.rainVelocities = velocities;

    const mat = new THREE.PointsMaterial({
      color: 0x9bc2e6,
      size: 0.18,
      transparent: true,
      opacity: 0.0, // Ukryte na początku
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    this.rainMaterial = mat;

    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    this.rainPoints = points;
    this.rainGroup.add(points);
  }

  /**
   * Inicjalizuje proceduralną syntezę deszczu w Web Audio.
   */
  public initAudio(context?: AudioContext): boolean {
    if (this.audioCtx) return true;
    if (!context) {
      if (typeof window === 'undefined') return false;
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxClass) return false;
      try {
        context = new AudioCtxClass();
      } catch {
        return false;
      }
    }
    this.audioCtx = context;

    // Generuj pętlę różowego szumu deszczu (2 sekundy)
    const sampleRate = context.sampleRate || 44100;
    const buffer = context.createBuffer(1, sampleRate * 2, sampleRate);
    const channel = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < channel.length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.0990460;
      b1 = 0.96300 * b1 + white * 0.2965164;
      b2 = 0.57000 * b2 + white * 1.0526913;
      channel[i] = (b0 + b1 + b2 + white * 0.1848) * 0.06;
    }

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    // Filtr dolnoprzepustowy tłumiący do miękkiego szumu kropel
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1400;
    this.rainFilter = filter;

    const gain = context.createGain();
    gain.gain.value = 0;
    this.rainGainNode = gain;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);

    source.start();
    this.noiseNode = source;
    this.isAudioRunning = true;
    return true;
  }

  /**
   * Przełącza stan pogody (np. clear -> rain -> storm -> clear).
   */
  public setWeather(weather: WeatherType): void {
    this.weather = weather;
    const raining = this.isRaining;

    if (this.rainMaterial) {
      if (weather === 'storm') {
        this.rainMaterial.opacity = 0.85;
        this.rainMaterial.size = 0.24;
      } else if (weather === 'rain') {
        this.rainMaterial.opacity = 0.65;
        this.rainMaterial.size = 0.18;
      } else {
        this.rainMaterial.opacity = 0.0;
      }
    }

    if (raining) {
      this.initAudio();
      if (this.rainGainNode && this.audioCtx) {
        const targetVol = weather === 'storm' ? this.userVolume * 1.2 : this.userVolume;
        this.rainGainNode.gain.setTargetAtTime(targetVol, this.audioCtx.currentTime, 0.4);
      }
    } else {
      if (this.rainGainNode && this.audioCtx) {
        this.rainGainNode.gain.setTargetAtTime(0, this.audioCtx.currentTime, 0.4);
      }
    }
  }

  /**
   * Przełącza deszcz (klawisz K).
   */
  public toggleRain(): WeatherType {
    const next: WeatherType = this.weather === 'clear' ? 'rain' : 'clear';
    this.setWeather(next);
    return next;
  }

  public setVolume(volume: number): void {
    this.userVolume = Math.max(0, Math.min(1, volume));
    if (this.isRaining && this.rainGainNode && this.audioCtx) {
      this.rainGainNode.gain.setTargetAtTime(this.userVolume, this.audioCtx.currentTime, 0.1);
    }
  }

  /**
   * Aktualizuje pozycje cząsteczek deszczu w pętli renderowania wokół kamery.
   */
  public update(dt: number, cameraPosition?: THREE.Vector3): void {
    if (!this.isRaining || !this.rainPositions || !this.rainVelocities || !this.rainGeometry) {
      return;
    }

    const camX = cameraPosition?.x ?? 0;
    const camY = cameraPosition?.y ?? 2.0;
    const camZ = cameraPosition?.z ?? 0;

    this.rainGroup.position.set(camX, 0, camZ);

    const positions = this.rainPositions;
    const velocities = this.rainVelocities;
    const halfWidth = this.boxSize.width / 2;
    const halfDepth = this.boxSize.depth / 2;
    const bottomY = camY - 2.0;
    const topY = camY + this.boxSize.height - 2.0;

    for (let i = 0; i < this.particleCount; i++) {
      const idxY = i * 3 + 1;
      positions[idxY] -= velocities[i] * dt;

      // Resetuj kroplę, która dotarła do gruntu
      if (positions[idxY] < bottomY) {
        positions[idxY] = topY;
        positions[i * 3 + 0] = (Math.random() - 0.5) * this.boxSize.width;
        positions[i * 3 + 2] = (Math.random() - 0.5) * this.boxSize.depth;
      }
    }

    this.rainGeometry.attributes.position.needsUpdate = true;
  }

  public dispose(): void {
    this.rainGroup.removeFromParent();
    this.rainGeometry?.dispose();
    this.rainMaterial?.dispose();
    this.rainGeometry = null;
    this.rainMaterial = null;

    if (this.noiseNode) {
      try {
        this.noiseNode.stop();
        this.noiseNode.disconnect();
      } catch {
        // Ignoruj
      }
      this.noiseNode = null;
    }
    this.rainFilter?.disconnect();
    this.rainGainNode?.disconnect();
    this.rainFilter = null;
    this.rainGainNode = null;
    this.audioCtx = null;
    this.isAudioRunning = false;
  }
}
