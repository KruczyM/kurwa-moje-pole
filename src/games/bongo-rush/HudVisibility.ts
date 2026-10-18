export interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Fade the floating HUD only while it would obscure the rendered hero. */
export function hudOverlapsPlayer(hud: ScreenRect, player: ScreenRect): boolean {
  return (
    hud.width > 0 &&
    hud.height > 0 &&
    player.x < hud.x + hud.width + 4 &&
    player.x + player.width > hud.x - 4 &&
    player.y < hud.y + hud.height + 4 &&
    player.y + player.height > hud.y - 4
  );
}
