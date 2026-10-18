export interface MinimapBox {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
}

/** The mobile overview lives in the existing control strip, never over the camera viewport. */
export function minimapLayout(
  width: number,
  height: number,
  top: number,
  playHeight: number,
  columns: number,
  rows: number,
  docked: boolean,
  footer = height < 400 ? 30 : 52,
): MinimapBox | undefined {
  const maxWidth = docked ? Math.min(76, Math.max(8, (width - 124) / 2 - 28)) : 156;
  const maxHeight = docked ? height - top - playHeight - footer - 20 : playHeight - 26;
  if (maxHeight <= 0 || columns <= 0 || rows <= 0) return undefined;
  const scale = Math.min(maxWidth / columns, maxHeight / rows);
  const mapWidth = columns * scale,
    mapHeight = rows * scale;
  return {
    x: width - mapWidth - 14,
    y: docked ? top + playHeight + 10 + (maxHeight - mapHeight) / 2 : top + 8,
    width: mapWidth,
    height: mapHeight,
    scale,
  };
}
