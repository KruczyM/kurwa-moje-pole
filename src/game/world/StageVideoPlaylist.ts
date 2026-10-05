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
  readonly video = document.createElement('video');
  readonly texture = new THREE.VideoTexture(this.video);
  private context?: AudioContext;
  private source?: MediaElementAudioSourceNode;
  private index = 0;
  private disposed = false;
  private failures = 0;
  private resume = () => {
    void this.play();
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

  constructor(private acoustics: SpatialStageAcoustics) {
    this.video.playsInline = true;
    this.video.preload = 'metadata';
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.name = 'StageConcertVideo';
    this.texture.center.set(0.5, 0.5);
    this.texture.rotation = Math.PI;
    this.texture.updateMatrix();
    this.video.addEventListener('ended', this.ended);
    this.video.addEventListener('error', this.error);
    window.addEventListener('pointerdown', this.resume);
    window.addEventListener('keydown', this.resume);
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

  async play(): Promise<void> {
    if (this.disposed) return;
    try {
      if (!this.context) {
        this.context = new AudioContext();
        if (
          !this.acoustics.initGraph(this.context) ||
          !this.acoustics.inputNode ||
          !this.acoustics.masterGain
        )
          return;
        this.source = this.context.createMediaElementSource(this.video);
        this.source.connect(this.acoustics.inputNode);
        this.acoustics.connectOutput(this.context.destination);
      }
      if (this.context.state === 'suspended') await this.context.resume();
      if (this.disposed) return;
      if (this.video.paused) await this.video.play();
    } catch {
      // Autoplay may be blocked; the next user gesture retries without hiding the error behind a mute.
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener('pointerdown', this.resume);
    window.removeEventListener('keydown', this.resume);
    this.video.removeEventListener('ended', this.ended);
    this.video.removeEventListener('error', this.error);
    this.video.pause();
    this.video.removeAttribute('src');
    this.video.load();
    this.source?.disconnect();
    this.texture.dispose();
    this.acoustics.dispose();
    void this.context?.close();
  }
}
