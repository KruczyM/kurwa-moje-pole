import * as THREE from 'three';
import { textureAssets } from '../assets/assetManifest';

export type SkyboxPeriod = 'day' | 'evening' | 'night';

/** Dobiera porę skyboxa z lokalnej godziny urządzenia. */
export function skyboxPeriodForHour(hour: number): SkyboxPeriod {
  if (hour >= 6 && hour < 18) return 'day';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'night';
}

/** Zarządza cubemapą nieba i zmienia ją po przekroczeniu granicy pory dnia. */
export class TimeOfDaySkybox {
  private period?: SkyboxPeriod;
  private texture?: THREE.CubeTexture;
  private nextCheckAt = 0;
  private requestToken = 0;
  private disposed = false;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.update(true);
  }

  /** Sprawdza lokalny czas najwyżej raz na minutę i ładuje właściwy zestaw sześciu ścian. */
  update(force = false) {
    if (this.disposed) return;
    const now = this.now();
    if (!force && now.getTime() < this.nextCheckAt) return;
    this.nextCheckAt = now.getTime() + 60_000;
    const period = skyboxPeriodForHour(now.getHours());
    if (period === this.period) return;
    this.period = period;
    this.load(period);
  }

  /** Podmienia tło dopiero po pełnym wczytaniu cubemapy, aby uniknąć czarnej klatki. */
  private load(period: SkyboxPeriod) {
    const token = ++this.requestToken;
    new THREE.CubeTextureLoader().load(
      textureAssets.skyboxes[period],
      (loaded) => {
        if (this.disposed || token !== this.requestToken) {
          loaded.dispose();
          return;
        }
        loaded.colorSpace = THREE.SRGBColorSpace;
        const previous = this.texture;
        this.texture = loaded;
        this.scene.background = loaded;
        previous?.dispose();
      },
      undefined,
      () => {
        if (token === this.requestToken) {
          console.error(`Nie udało się wczytać skyboxa dla pory: ${period}`);
          this.period = undefined;
        }
      },
    );
  }

  /** Anuluje spóźnione odpowiedzi i zwalnia teksturę cubemapy. */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.requestToken++;
    if (this.scene.background === this.texture) this.scene.background = null;
    this.texture?.dispose();
    this.texture = undefined;
  }
}
