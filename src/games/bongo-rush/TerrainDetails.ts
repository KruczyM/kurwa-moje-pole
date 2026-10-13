import type { Cell, World } from './types';

/** Small alpha openings fit within a 14.1% pixel budget, never touching the solid outer boundary. */
export function soilHoles(biome: number, variant: number) {
  const shift = (Math.abs(Math.trunc(variant)) % 4) * 2;
  return Array.from({ length: 6 }, (_, index) => {
    const x = 6 + ((index * 11 + shift) % 43);
    const y = 7 + ((index * 17 + biome * 7) % 35);
    return { x, y, width: biome === 2 ? 8 : 6, height: biome === 2 ? 8 : 16 };
  });
}

/** Punches only the cached soil art; simulation cells and original images remain untouched. */
export function punchSoil(ctx: CanvasRenderingContext2D, biome: number, variant: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000';
  for (const hole of soilHoles(biome, variant)) {
    const { x, y, width, height } = hole;
    ctx.beginPath();
    ctx.moveTo(x, y + 2);
    ctx.lineTo(x + width - 1, y);
    ctx.lineTo(x + width, y + height - 3);
    ctx.lineTo(x + width - 1, y + height);
    ctx.lineTo(x + 1, y + height - 1);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** Exposed tunnel sides depend only on adjacent cells; outside the level remains solid. */
export function terrainEdges(world: Pick<World, 'width' | 'height' | 'cells'>, x: number, y: number): number {
  const open = (nx: number, ny: number) => {
    if (nx < 0 || ny < 0 || nx >= world.width || ny >= world.height) return false;
    const cell: Cell = world.cells[ny * world.width + nx];
    return cell === 'air' || cell === 'exit';
  };
  return (
    (open(x, y - 1) ? 1 : 0) | (open(x + 1, y) ? 2 : 0) | (open(x, y + 1) ? 4 : 0) | (open(x - 1, y) ? 8 : 0)
  );
}

/** Draws biome-shaped silhouettes inside the tile, leaving the playable tunnel completely clear. */
export function paintTerrainEdges(ctx: CanvasRenderingContext2D, mask: number, biome: number): void {
  ctx.save();
  for (let side = 0; side < 4; side++) {
    if (!(mask & (1 << side))) continue;
    ctx.save();
    ctx.translate(32, 32);
    ctx.rotate((side * Math.PI) / 2);
    ctx.translate(-32, -32);
    ctx.fillStyle = ['#442719', '#273d29', '#222337', '#2e596b'][biome];
    ctx.fillRect(0, 0, 64, 3);
    ctx.fillStyle = ['#bd834c', '#819856', '#8395b6', '#b8e7f0'][biome];
    for (let i = 0; i < 5; i++) {
      const x = i * 13 + 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + (biome === 1 ? 2 : 5), 4 + (i % 3) * 2);
      ctx.lineTo(x + 8, 0);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
}
