import { BIOMES } from './Levels';

/** Paints deterministic mineral/gravel textures into the renderer's existing small tile cache. */
export function paintCaveTile(
  ctx: CanvasRenderingContext2D,
  biomeIndex: number,
  kind: 'wall' | 'soil',
  variant: number,
): void {
  const biome = BIOMES[biomeIndex];
  ctx.fillStyle = kind === 'wall' ? '#0e141a' : biome.soil;
  ctx.fillRect(0, 0, 64, 64);
  if (kind === 'wall') {
    // Interlocking rough facets replace the old rounded warehouse-brick grid.
    for (let stone = 0; stone < 7; stone++) {
      const x = (stone * 23 + variant * 11) % 61;
      const y = (stone * 31 + variant * 17) % 61;
      const r = 15 + (stone % 3) * 4;
      const shade = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
      shade.addColorStop(0, biome.wall);
      shade.addColorStop(1, '#151e24');
      ctx.fillStyle = shade;
      ctx.strokeStyle = '#060d1480';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let corner = 0; corner < 7; corner++) {
        const angle = (corner * Math.PI * 2) / 7;
        const radius = r - ((corner + stone) % 3) * 3;
        ctx.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#ffffff15';
      ctx.beginPath();
      ctx.moveTo(x - r * 0.5, y - r * 0.25);
      ctx.lineTo(x, y - r * 0.7);
      ctx.lineTo(x + r * 0.5, y - r * 0.4);
      ctx.stroke();
    }
  }
  for (let grain = 0; grain < (kind === 'soil' ? 140 : 35); grain++) {
    const x = (grain * 37 + variant * 19) % 64;
    const y = (grain * 23 + Math.floor(grain / 7) * 11 + variant * 29) % 64;
    ctx.fillStyle = grain % 3 === 0 ? '#050c1480' : grain % 3 === 1 ? '#ffffff13' : `${biome.light}40`;
    ctx.fillRect(x, y, grain % 4 === 0 ? 3 : 1.5, grain % 5 === 0 ? 2.5 : 1);
  }
  if (biomeIndex === 1 && kind === 'wall') {
    ctx.strokeStyle = '#87b57c55';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(variant * 14 + 8, 0);
    ctx.bezierCurveTo(50, 10, 8, 42, 44 - variant * 8, 64);
    ctx.stroke();
  }
  if (biomeIndex >= 2 && kind === 'wall') {
    ctx.fillStyle = `${biome.light}60`;
    ctx.beginPath();
    ctx.moveTo(43, 16);
    ctx.lineTo(48, 27);
    ctx.lineTo(40, 34);
    ctx.closePath();
    ctx.fill();
  }
}
