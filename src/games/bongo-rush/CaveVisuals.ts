/** Distinct construction languages, not four colour variants of the same rock texture. */
export const CAVE_WALL_STYLES = ['masonry', 'braided-roots', 'industrial-panels', 'fractured-ice'] as const;

/** Draws an open or closed polyline in local 64-pixel tile coordinates. */
function line(ctx: CanvasRenderingContext2D, points: readonly number[], closed = false): void {
  ctx.beginPath();
  ctx.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
  if (closed) ctx.closePath();
}

/** Staggered fired bricks, deep mortar, chipped edges and iron ties for the warehouse. */
function masonry(ctx: CanvasRenderingContext2D, variant: number): void {
  ctx.fillStyle = '#251d1c';
  ctx.fillRect(0, 0, 64, 64);
  for (let row = 0; row < 4; row++) {
    const shift = (row % 2) * 16;
    for (let column = -1; column < 3; column++) {
      const x = column * 32 + shift + 2,
        y = row * 16 + 2;
      ctx.fillStyle = ['#835748', '#6d463a', '#97634e'][(row + column + variant + 3) % 3];
      ctx.fillRect(x, y, 29, 13);
      ctx.strokeStyle = '#d89b6b70';
      line(ctx, [x, y + 12, x, y, x + 28, y]);
      ctx.stroke();
      ctx.strokeStyle = '#2e211e';
      line(ctx, [x + 18, y, x + 16, y + 4, x + 19, y + 7]);
      ctx.stroke();
    }
  }
  ctx.fillStyle = '#303b3e';
  ctx.fillRect(4 + variant * 13, 28, 15, 6);
  ctx.fillStyle = '#9c9c83';
  ctx.fillRect(6 + variant * 13, 30, 2, 2);
}

/** Broad intertwined wooden roots and branching tendrils replace masonry entirely. */
function roots(ctx: CanvasRenderingContext2D, variant: number): void {
  ctx.fillStyle = '#101f17';
  ctx.fillRect(0, 0, 64, 64);
  for (let root = 0; root < 5; root++) {
    const x = root * 17 - 8 + variant * 3;
    const shade = ctx.createLinearGradient(x - 8, 0, x + 10, 0);
    shade.addColorStop(0, '#17271a');
    shade.addColorStop(0.5, '#65854a');
    shade.addColorStop(1, '#293f26');
    ctx.strokeStyle = shade;
    ctx.lineWidth = 12 - root;
    ctx.beginPath();
    ctx.moveTo(x, -8);
    ctx.bezierCurveTo(x + 25, 16, x - 17, 45, x + 12, 72);
    ctx.stroke();
    ctx.strokeStyle = '#adc07b55';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 2, -8);
    ctx.bezierCurveTo(x + 27, 16, x - 15, 45, x + 14, 72);
    ctx.stroke();
  }
  ctx.strokeStyle = '#94ae5d';
  ctx.lineWidth = 2;
  line(ctx, [0, 46, 18, 36, 34, 40, 47, 29, 64, 33]);
  ctx.stroke();
  for (let leaf = 0; leaf < 4; leaf++) {
    ctx.fillStyle = '#4e8e57';
    ctx.beginPath();
    ctx.ellipse(10 + leaf * 15, 35 + (leaf % 2) * 8, 5, 2, -0.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Dark steel cassette with neon conduits, fasteners and hazard corners for the rave. */
function panels(ctx: CanvasRenderingContext2D, variant: number): void {
  ctx.fillStyle = '#080c18';
  ctx.fillRect(0, 0, 64, 64);
  const shade = ctx.createLinearGradient(0, 0, 64, 64);
  shade.addColorStop(0, '#455265');
  shade.addColorStop(1, '#192334');
  ctx.fillStyle = shade;
  line(ctx, [10, 4, 54, 4, 60, 10, 60, 54, 54, 60, 10, 60, 4, 54, 4, 10], true);
  ctx.fill();
  ctx.strokeStyle = '#748491';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#101726';
  ctx.fillRect(16, 19, 32, 26);
  for (let vent = 0; vent < 5; vent++) {
    ctx.fillStyle = '#5a6676';
    ctx.fillRect(20 + variant, 22 + vent * 4, 24 - variant, 1);
  }
  ctx.strokeStyle = variant % 2 ? '#e68af1' : '#66e8e4';
  ctx.lineWidth = 2;
  line(ctx, [0, 12, 11, 12, 11, 51, 53, 51, 53, 64]);
  ctx.stroke();
  ctx.fillStyle = '#c7c6ad';
  for (const x of [8, 54]) for (const y of [8, 54]) ctx.fillRect(x, y, 2, 2);
  ctx.strokeStyle = '#e2ba55';
  line(ctx, [44, 8, 50, 14, 54, 14]);
  ctx.stroke();
}

/** Large translucent angular plates, branching fractures and trapped bubbles for the final grotto. */
function ice(ctx: CanvasRenderingContext2D, variant: number): void {
  ctx.fillStyle = '#183945';
  ctx.fillRect(0, 0, 64, 64);
  const shade = ctx.createLinearGradient(0, 0, 64, 64);
  shade.addColorStop(0, '#d3f4ed');
  shade.addColorStop(0.45, '#78afbc');
  shade.addColorStop(1, '#315c78');
  ctx.fillStyle = shade;
  line(ctx, [-2, -2, 58, -2, 43, 24 + variant, 20, 37, -2, 29], true);
  ctx.fill();
  ctx.fillStyle = '#86c6d6';
  line(ctx, [66, 3, 45, 28, 22, 41, 36, 66, 66, 66], true);
  ctx.fill();
  ctx.strokeStyle = '#edffff';
  ctx.lineWidth = 1.5;
  line(ctx, [58, 0, 43, 25, 21, 39, 35, 64]);
  ctx.stroke();
  line(ctx, [43, 25, 30, 15, 27, 0]);
  ctx.stroke();
  ctx.strokeStyle = '#d8ffff70';
  for (let bubble = 0; bubble < 4; bubble++) {
    ctx.beginPath();
    ctx.arc((bubble * 17 + variant * 7 + 9) % 58, 8 + bubble * 13, 1 + (bubble % 2), 0, Math.PI * 2);
    ctx.stroke();
  }
}

/** Diggable material has a separate, lower-contrast surface in every biome. */
function soil(ctx: CanvasRenderingContext2D, biome: number, variant: number): void {
  ctx.fillStyle = ['#44322a', '#1c3020', '#242434', '#385963'][biome];
  ctx.fillRect(0, 0, 64, 64);
  for (let grain = 0; grain < 90; grain++) {
    const x = (grain * 37 + variant * 19) % 64;
    const y = (grain * 23 + Math.floor(grain / 7) * 11 + variant * 29) % 64;
    ctx.fillStyle = grain % 2 ? '#050c1460' : ['#c18f6540', '#94bb5640', '#ad93bb40', '#c7f5f750'][biome];
    ctx.fillRect(x, y, biome === 3 ? 3 : 1.5, biome === 0 ? 2 : 1);
  }
  ctx.lineWidth = 1;
  ctx.strokeStyle = ['#9b6a4930', '#73934c60', '#9a63a170', '#a9e7ea60'][biome];
  if (biome === 1) {
    for (let root = 0; root < 3; root++) {
      ctx.beginPath();
      ctx.moveTo(root * 23, 0);
      ctx.bezierCurveTo(15, 20 + root * 7, 48, 42, root * 23 + 9, 64);
      ctx.stroke();
    }
  } else if (biome === 2) {
    line(ctx, [0, 19, 25, 19, 25, 40, 64, 40]);
    ctx.stroke();
  } else if (biome === 3) {
    for (let flake = 0; flake < 4; flake++) {
      const x = 9 + flake * 14,
        y = ((flake * 19 + variant * 7) % 54) + 5;
      line(ctx, [x - 3, y, x + 3, y]);
      ctx.stroke();
      line(ctx, [x, y - 3, x, y + 3]);
      ctx.stroke();
    }
  }
}

/** Paints deterministic biome-specific textures once into the existing renderer tile cache. */
export function paintCaveTile(
  ctx: CanvasRenderingContext2D,
  biome: number,
  kind: 'wall' | 'soil',
  variant: number,
): void {
  if (kind === 'soil') soil(ctx, biome, variant);
  else [masonry, roots, panels, ice][biome](ctx, variant);
}
