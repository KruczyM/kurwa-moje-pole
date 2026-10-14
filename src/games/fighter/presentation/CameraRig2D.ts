import { arenaCameraX, arenaZoom, CAMERA_SHAKE_MARGIN, cinematicZoom } from './stageLayout';

export class CameraRig2D {
  public reducedEffects = false;
  public cinematic = false;
  public x = 0;
  public y = 140; // Ground line height offset in canvas
  public zoom = 1.0;
  private cinematicBlend = 0;
  private shakeTime = 0;
  private shakeIntensity = 0;

  /**
   * Arcade fighting camera: constant zoom for the viewport, follows the (interpolated)
   * midpoint without lag and stops at the arena edges. Only the super-freeze punch-in eases.
   */
  update(p1x: number, p2x: number, dt: number, width = 1280, height = 720): void {
    const base = arenaZoom(width, height);
    const target = this.cinematic ? 1 : 0;
    this.cinematicBlend += (target - this.cinematicBlend) * Math.min(1.0, dt * 6.0);
    if (Math.abs(target - this.cinematicBlend) < 0.001) this.cinematicBlend = target;
    const punchIn = cinematicZoom(width, base, p1x, p2x);
    this.zoom = base + (punchIn - base) * this.cinematicBlend;
    this.x = arenaCameraX((p1x + p2x) / 2, width, this.zoom);

    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      if (this.shakeTime <= 0) {
        this.shakeIntensity = 0;
      }
    }
  }

  shake(intensity = 8, duration = 0.2): void {
    if (this.reducedEffects) return;
    this.shakeIntensity = Math.max(0, Math.min(CAMERA_SHAKE_MARGIN, intensity));
    this.shakeTime = duration;
  }

  getShakeOffset(): { x: number; y: number } {
    if (this.reducedEffects || this.shakeTime <= 0) return { x: 0, y: 0 };
    return {
      x: (Math.random() - 0.5) * this.shakeIntensity * 2,
      y: (Math.random() - 0.5) * this.shakeIntensity * 2,
    };
  }
}
