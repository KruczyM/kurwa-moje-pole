export interface MinimapBox {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
}

/** Optional overview overlays the cave without changing its camera or tile scale. */
export function minimapLayout(
  width: number,
  height: number,
  top: number,
  columns: number,
  rows: number,
  compact: boolean,
): MinimapBox | undefined {
  const maxWidth = Math.min(compact ? 76 : 156, width - 28);
  const maxHeight = Math.min(compact ? 140 : 220, (height - top - 20) * 0.45);
  if (maxWidth <= 0 || maxHeight <= 0 || columns <= 0 || rows <= 0) return undefined;
  const scale = Math.min(maxWidth / columns, maxHeight / rows);
  return { x: width - columns * scale - 14, y: top + 8, width: columns * scale, height: rows * scale, scale };
}
