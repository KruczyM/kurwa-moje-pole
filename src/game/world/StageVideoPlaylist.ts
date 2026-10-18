import * as THREE from 'three';
import { SpatialStageAcoustics } from '../audio/SpatialStageAcoustics';

export const STAGE_VIDEO_FILES = [
  'happysad-zanim-pojde.mp4',
  'kwiat-jabloni-plachta-nieba.mp4',
  'lady-pank-kryzysowa-narzeczona.mp4',
  'lydka-grubasa-gender.mp4',
  'lydka-grubasa-nie-jem-nic.mp4',
  'mrzoob-moj-jest-ten-kawalek-podlogi.mp4',
  'pull-the-wire-morskie-opowiesci-pirat-drogowy.mp4',
  'pull-the-wire-zycie-to-western-ft-jurek-owsiak.mp4',
  'sztywny-pal-azji-nieprzemakalni.mp4',
  'wojtek-szumanski-tomek.mp4',
] as const;

export function isStageAudienceCut(seconds: number): boolean {
  return seconds >= 30 && seconds % 30 < 3;
}

/** A single media element feeds both screens and the existing spatial audio graph. */
export class StageVideoPlaylist {
  readonly video: HTMLVideoElement =
    typeof document !== 'undefined'
      ? document.createElement('video')
      : ({
          playsInline: false,
          muted: false,
          defaultMuted: false,
          preload: '',
          addEventListener: () => {},
          removeEventListener: () => {},
          load: () => {},
          play: async () => {},
          pause: () => {},
          removeAttribute: () => {},
          remove: () => {},
        } as unknown as HTMLVideoElement);
  readonly texture = new THREE.VideoTexture(this.video);
  private context?: AudioContext;
  private source?: MediaElementAudioSourceNode;
  private index: number;
  private disposed = false;
  private failures = 0;
  private readonly unlockEvents = ['pointerdown', 'touchend', 'keydown'] as const;
  private resume = () => {
    void this.play(true);
  };
  private ended = () => {
    this.failures = 0;
    this.advance();
  };
  private error = () => {
    if (++this.failures < STAGE_VIDEO_FILES.length) this.advance();
  };

  get currentFile(): string {
    return STAGE_VIDEO_FILES[this.index];
  }

  constructor(
    private acoustics: SpatialStageAcoustics,
    initialIndex?: number,
  ) {
    const totalFiles = STAGE_VIDEO_FILES.length;
    this.index =
      initialIndex !== undefined
        ? ((initialIndex % totalFiles) + totalFiles) % totalFiles
        : Math.floor(Math.random() * totalFiles);
    this.video.playsInline = true;
    this.video.muted = true;
    this.video.defaultMuted = true;
    this.video.preload = 'metadata';
    if (typeof document !== 'undefined') {
      // WebKit needs a composited DOM video before play() to supply WebGL frames.
      // Keep its decoding surface at concert resolution, without a visible player.
      this.video.width = 960;
      this.video.height = 540;
      this.video.tabIndex = -1;
      this.video.setAttribute('aria-hidden', 'true');
      Object.assign(this.video.style, {
        position: 'fixed',
        left: '0',
        top: '0',
        width: '960px',
        height: '540px',
        opacity: '0',
        clipPath: 'inset(100%)',
        pointerEvents: 'none',
      });
      document.body.append(this.video);
    }
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.name = 'StageConcertVideo';
    this.texture.center.set(0.5, 0.5);
    this.texture.rotation = Math.PI;
    this.texture.updateMatrix();
    this.video.addEventListener('ended', this.ended);
    this.video.addEventListener('error', this.error);
    if (typeof window !== 'undefined') {
      for (const event of this.unlockEvents) window.addEventListener(event, this.resume);
    }
    this.load();
  }

  private load(): void {
    this.video.src = `${import.meta.env.BASE_URL}game-assets/videos/stage/${this.currentFile}`;
    this.video.load();
    void this.play();
  }

  private advance(): void {
    if (this.disposed) return;
    this.index = (this.index + 1) % STAGE_VIDEO_FILES.length;
    this.load();
  }

  /** Start silent pictures immediately; unlock spatial audio directly inside a user gesture. */
  async play(unlockAudio = false): Promise<void> {
    if (this.disposed) return;
    if (unlockAudio) {
      try {
        if (!this.context) {
          this.context = new AudioContext();
          if (
            this.acoustics.initGraph(this.context) &&
            this.acoustics.inputNode &&
            this.acoustics.masterGain
          ) {
            this.source = this.context.createMediaElementSource(this.video);
            this.source.connect(this.acoustics.inputNode);
            this.acoustics.connectOutput(this.context.destination);
          }
        }
        // Never await audio resume before video.play(): Safari needs the original gesture.
        if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
        if (this.source) this.video.muted = false;
      } catch {
        // An unavailable audio graph must not prevent the shared video texture from advancing.
        this.video.muted = true;
      }
    }
    try {
      if (this.video.paused || unlockAudio) await this.video.play();
    } catch {
      if (this.disposed || this.video.muted) return;
      this.video.muted = true;
      try {
        await this.video.play();
      } catch {
        /* The next gesture retries playback. */
      }
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (typeof window !== 'undefined') {
      for (const event of this.unlockEvents) window.removeEventListener(event, this.resume);
    }
    this.video.removeEventListener('ended', this.ended);
    this.video.removeEventListener('error', this.error);
    this.video.pause();
    this.video.removeAttribute('src');
    this.video.load();
    this.video.remove();
    this.source?.disconnect();
    this.texture.dispose();
    this.acoustics.dispose();
    void this.context?.close();
  }
}
