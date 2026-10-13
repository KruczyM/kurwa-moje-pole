/** Cached AI illustrations; only the active pair owns decoded prop images. */
export class SuperPropsRenderer {
  private propImages = new Map<string, HTMLImageElement>();

  retain(ids: string[]): void {
    const wanted = new Set([
      ...ids,
      ...(ids.includes('gruczol') ? ['paper'] : []),
      ...(ids.some((id) => ['pierscien', 'pien', 'chlebak'].includes(id)) ? ['soundwave'] : []),
    ]);
    for (const [id, image] of this.propImages) {
      if (!wanted.has(id)) {
        image.removeAttribute('src');
        this.propImages.delete(id);
      }
    }
    for (const id of wanted) this.getPropImage(id);
  }

  getPropImage(id: string): HTMLImageElement | null {
    if (typeof Image === 'undefined') return null;
    let image = this.propImages.get(id);
    if (!image) {
      image = new Image();
      image.decoding = 'async';
      image.src = `${import.meta.env.BASE_URL}game-assets/2d/fighter/art-v3/props/${encodeURIComponent(id)}.webp`;
      this.propImages.set(id, image);
    }
    return image.complete && image.naturalWidth > 0 ? image : null;
  }

  drawProp(
    ctx: CanvasRenderingContext2D,
    id: string,
    x: number,
    y: number,
    width: number,
    height: number,
    angle = 0,
    facing = 1,
  ): void {
    const image = this.getPropImage(id);
    if (!image) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(facing, 1);
    const fit = Math.min(width / image.naturalWidth, height / image.naturalHeight);
    const w = image.naturalWidth * fit,
      h = image.naturalHeight * fit;
    ctx.drawImage(image, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
}

/** The visible projectile reaches the target at the first authoritative active tick. */
export function ultimatePropPose(
  t: number,
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  id: string,
) {
  const progress = Math.max(0, Math.min(1, id === 'szerszen' ? (t - 50) / 25 : (t - 35) / 40));
  const high = id === 'szerszen' ? 175 : id === 'dziaslo' ? 360 : 95;
  return {
    x: startX + (targetX - startX) * progress,
    y:
      -(startY + high) * (1 - progress) -
      (targetY + 65) * progress -
      Math.sin(progress * Math.PI) * (id === 'hemoroid' ? 0 : 45),
    angle: ['szerszen', 'korba', 'amper', 'krwiak', 'ambona', 'jeczmien'].includes(id)
      ? progress * Math.PI * 6
      : 0,
    progress,
  };
}
