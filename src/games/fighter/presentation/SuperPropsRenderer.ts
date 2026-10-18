const REVISED_PROPS: Record<string, string> = {
  gruczol: 'wc_tron_open',
  gruczol_right: 'wc_tron_open_right',
  chlebak: 'dj_operator_side',
  jeczmien: 'lighter',
  ambona: 'pinecone',
  pien: 'megaphone',
  krwiak: 'summer_contrast',
};
const propKey = (id: string): string =>
  id.startsWith('legacy_') && !REVISED_PROPS[id.slice(7)] ? id.slice(7) : id;

/** Cached AI illustrations; only the active pair owns decoded prop images. */
export class SuperPropsRenderer {
  private propImages = new Map<string, HTMLImageElement>();

  retain(ids: string[]): void {
    const wanted = new Set(
      [
        ...ids.filter((id) => !['kobra', 'klatwa', 'antena'].includes(id)),
        ...ids.map((id) => `legacy_${id}`),
        ...(ids.includes('gruczol') ? ['paper', 'gruczol_right'] : []),
        ...(ids.some((id) => ['chlebak', 'pien', 'pierscien'].includes(id)) ? ['soundwave'] : []),
      ].map(propKey),
    );
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
    id = propKey(id);
    let image = this.propImages.get(id);
    if (!image) {
      image = new Image();
      image.decoding = 'async';
      const folder = REVISED_PROPS[id] ? 'motion-v4/props' : 'art-v3/props';
      const assetId = id.startsWith('legacy_') ? id.slice(7) : (REVISED_PROPS[id] ?? id);
      image.src = `${import.meta.env.BASE_URL}game-assets/2d/fighter/${folder}/${encodeURIComponent(assetId)}.webp`;
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
    frame = 0,
    columns = 1,
  ): void {
    if (id === 'vinyl') {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.scale(width / 40, height / 40);
      ctx.fillStyle = '#111318';
      ctx.beginPath();
      ctx.arc(0, 0, 19, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#70747e';
      ctx.lineWidth = 0.7;
      for (const radius of [11, 14, 17]) {
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = '#f72585';
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff5da';
      ctx.beginPath();
      ctx.arc(0, 0, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    const image = this.getPropImage(id);
    if (!image) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(facing, 1);
    const sourceWidth = image.naturalWidth / columns;
    const fit = Math.min(width / sourceWidth, height / image.naturalHeight);
    const w = sourceWidth * fit,
      h = image.naturalHeight * fit;
    if (columns > 1) {
      const cell = Math.max(0, Math.min(columns - 1, Math.floor(frame)));
      ctx.drawImage(image, cell * sourceWidth, 0, sourceWidth, image.naturalHeight, -w / 2, -h / 2, w, h);
    } else ctx.drawImage(image, -w / 2, -h / 2, w, h);
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
