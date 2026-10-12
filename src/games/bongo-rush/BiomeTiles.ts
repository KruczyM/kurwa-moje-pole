export const BIOME_TILE_ATLASES = ['amarena-v1.png', 'roots-v1.png', 'rave-v1.png', 'glass-v1.png'] as const;
export type TerrainKind = 'wall' | 'soil';

/** Resolves a complete wall/soil quadrant, rejecting malformed sheets instead of sampling neighbouring art. */
export function biomeTileRect(width: number, height: number, kind: TerrainKind, variant: number) {
  if (!Number.isInteger(width) || width < 4 || width !== height || width % 2 !== 0)
    throw new Error('Atlas biomu musi być kwadratową grafiką o parzystym rozmiarze.');
  const size = width / 2;
  const column = Math.abs(Math.trunc(variant)) % 2;
  return { x: column * size, y: kind === 'wall' ? 0 : size, width: size, height: size };
}

/** Chooses stable scattered variants rather than a conspicuous checkerboard or random changes each frame. */
export function terrainVariant(x: number, y: number): number {
  let hash = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return (hash ^ (hash >>> 16)) & 1;
}

/** Bakes one generated quadrant to the existing small tile cache; source images are never modified. */
export function paintBiomeTile(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  kind: TerrainKind,
  variant: number,
): void {
  const rect = biomeTileRect(image.naturalWidth, image.naturalHeight, kind, variant);
  context.save();
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, rect.x, rect.y, rect.width, rect.height, 0, 0, 64, 64);
  // Diggable cells remain subdued behind sprites; walls have a sharper structural edge.
  if (kind === 'soil') {
    context.fillStyle = '#00000022';
    context.fillRect(0, 0, 64, 64);
  } else {
    context.strokeStyle = '#060b1548';
    context.lineWidth = 1;
    context.strokeRect(0.5, 0.5, 63, 63);
  }
  context.restore();
}
