export const SCENES = [
  { file: 'amarena-v1.png', accent: '#efb55d' },
  { file: 'roots-v1.png', accent: '#8bdbab' },
  { file: 'rave-v1.png', accent: '#d284ef' },
  { file: 'glass-v1.png', accent: '#8ccee9' },
] as const;

/** Stable ambient points require no allocation of particle objects or random per-frame reseeding. */
export function sceneParticle(index: number, clock: number, menu: boolean) {
  const speed = menu ? 0.012 : 0.003;
  return {
    x: (((index * 0.61803398875 + clock * speed) % 1) + 1) % 1,
    y: 0.14 + ((((index * 0.381966 + Math.sin(clock * 0.25 + index) * 0.018) % 0.7) + 0.7) % 0.7),
    alpha: 0.22 + (Math.sin(clock * 0.7 + index * 2) + 1) * 0.17,
  };
}

/** Small cheap reflection strokes and fireflies stay behind the terrain and do not signal gameplay. */
export function paintSceneMotion(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  biome: number,
  clock: number,
  menu: boolean,
  reducedMotion: boolean,
): void {
  if (reducedMotion) return;
  ctx.save();
  ctx.fillStyle = SCENES[biome].accent;
  for (let index = 0; index < (menu ? 24 : 12); index++) {
    const point = sceneParticle(index, clock, menu);
    ctx.globalAlpha = point.alpha * (menu ? 1 : 0.45);
    ctx.fillRect(Math.round(point.x * width), Math.round(point.y * height), 2, 2);
  }
  for (let index = 0; index < 9; index++) {
    ctx.globalAlpha = (menu ? 0.09 : 0.025) * (1 + Math.sin(clock * 0.8 + index));
    const x = width * (0.08 + index * 0.103) + Math.sin(clock * 0.4 + index) * 6;
    ctx.fillRect(x, height * (0.78 + (index % 4) * 0.04), 10 + index * 4, 1);
  }
  ctx.restore();
}
