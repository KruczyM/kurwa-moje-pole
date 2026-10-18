import { describe, expect, it } from 'vitest';
import { hudOverlapsPlayer } from './HudVisibility';
describe('floating HUD visibility', () => {
  const hud = { x: 12, y: 8, width: 366, height: 68 };
  it('detects upper-row hero overlap, including sprite edges', () => {
    expect(hudOverlapsPlayer(hud, { x: 175, y: 40, width: 40, height: 40 })).toBe(true);
    expect(hudOverlapsPlayer(hud, { x: 175, y: 76, width: 40, height: 40 })).toBe(true);
  });
  it('restores the HUD when the hero moves clear and ignores hidden HUDs', () => {
    expect(hudOverlapsPlayer(hud, { x: 175, y: 100, width: 40, height: 40 })).toBe(false);
    expect(hudOverlapsPlayer(hud, { x: 400, y: 20, width: 40, height: 40 })).toBe(false);
    expect(hudOverlapsPlayer({ ...hud, width: 0 }, { x: 0, y: 0, width: 40, height: 40 })).toBe(false);
  });
});
