export class CameraRig2D {
  public reducedEffects = false;
  public cinematic = false;
  public x = 0;
  public y = 140; // Ground line height offset in canvas
  public zoom = 1.0;
  private shakeTime = 0;
  private shakeIntensity = 0;

  update(p1x: number, p2x: number, dt: number): void {
    const targetX = (p1x + p2x) / 2;
    // Smooth camera lag
    this.x += (targetX - this.x) * Math.min(1.0, dt * 8.0);

    // Zoom based on distance
    const dist = Math.abs(p2x - p1x);
    // When close (dist < 200), zoom in to 1.15. When far (dist > 600), zoom out to 0.85
    const targetZoom = this.cinematic ? 1.22 : Math.max(0.82, Math.min(1.15, 1.25 - (dist / 800) * 0.4));
    this.zoom += (targetZoom - this.zoom) * Math.min(1.0, dt * 6.0);

    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      if (this.shakeTime <= 0) {
        this.shakeIntensity = 0;
      }
    }
  }

  shake(intensity = 8, duration = 0.2): void {
    if (this.reducedEffects) return;
    this.shakeIntensity = intensity;
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
