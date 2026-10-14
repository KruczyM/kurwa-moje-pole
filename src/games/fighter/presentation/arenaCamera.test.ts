import { describe, expect, it } from 'vitest';
import {
  arenaCameraX,
  arenaZoom,
  CAMERA_SHAKE_MARGIN,
  GROUND_SCREEN_RATIO,
  stageLayout,
} from './stageLayout';
import { CameraRig2D } from './CameraRig2D';
import { MAX_FIGHTER_SEPARATION, STAGE_HALF_WIDTH } from '../simulation/Movement';
import { locomotionPose } from './locomotion';
import type { FighterState } from '../simulation/CombatTypes';

describe('Arcade fighting camera and arena layout', () => {
  it('keeps zoom strictly constant regardless of fighter positions or distance', () => {
    const cam = new CameraRig2D();
    const width = 844;
    const height = 390;

    // Test close distance (100)
    cam.update(-50, 50, 0.016, width, height);
    const closeZoom = cam.zoom;

    // Test mid distance (300)
    cam.update(-150, 150, 0.016, width, height);
    const midZoom = cam.zoom;

    // Test max camera wall distance (520)
    cam.update(-260, 260, 0.016, width, height);
    const maxZoom = cam.zoom;

    expect(closeZoom).toBeCloseTo(arenaZoom(width, height), 3);
    expect(midZoom).toBeCloseTo(arenaZoom(width, height), 3);
    expect(maxZoom).toBeCloseTo(arenaZoom(width, height), 3);
  });

  it('keeps both fighters and reach margins visible on screen across viewports', () => {
    const viewports = [
      { width: 390, height: 844 },   // Mobile portrait
      { width: 844, height: 390 },   // Mobile landscape
      { width: 1024, height: 768 },  // Tablet
      { width: 1920, height: 1080 }, // Desktop 1080p
    ];

    for (const vp of viewports) {
      const zoom = arenaZoom(vp.width, vp.height);

      // Test extreme positions within arena and max separation
      // A fighter's visible boundary is clamped by the arena wall (can't stand beyond wall)
      const halfSprite = 60; // Max visual half-width of a fighter body
      const scenarios = [
        { p1: -MAX_FIGHTER_SEPARATION / 2, p2: MAX_FIGHTER_SEPARATION / 2 },
        { p1: -STAGE_HALF_WIDTH + halfSprite, p2: -STAGE_HALF_WIDTH + halfSprite + MAX_FIGHTER_SEPARATION },
        { p1: STAGE_HALF_WIDTH - halfSprite - MAX_FIGHTER_SEPARATION, p2: STAGE_HALF_WIDTH - halfSprite },
      ];

      for (const { p1, p2 } of scenarios) {
        const mid = (p1 + p2) / 2;
        const camX = arenaCameraX(mid, vp.width, zoom);

        const leftFighterEdge = Math.max(-STAGE_HALF_WIDTH, Math.min(p1, p2) - halfSprite);
        const rightFighterEdge = Math.min(STAGE_HALF_WIDTH, Math.max(p1, p2) + halfSprite);

        const screenLeft = vp.width / 2 + (leftFighterEdge - camX) * zoom;
        const screenRight = vp.width / 2 + (rightFighterEdge - camX) * zoom;

        expect(screenLeft).toBeGreaterThanOrEqual(-0.01);
        expect(screenRight).toBeLessThanOrEqual(vp.width + 0.01);
      }
    }
  });

  it('blocks camera scrolling when fighters are near arena boundaries', () => {
    const width = 1280;
    const height = 720;
    const zoom = arenaZoom(width, height);
    const halfView = width / (2 * zoom);
    const maxLimit = Math.max(0, STAGE_HALF_WIDTH - halfView);

    // Far left corner
    const leftCam = arenaCameraX(-800, width, zoom);
    expect(leftCam).toBe(-maxLimit);

    // Far right corner
    const rightCam = arenaCameraX(800, width, zoom);
    expect(rightCam).toBe(maxLimit);

    // Visible left edge of camera should never view past -STAGE_HALF_WIDTH
    const leftEdgeWorld = leftCam - halfView;
    expect(leftEdgeWorld).toBeCloseTo(-Math.max(STAGE_HALF_WIDTH, halfView), 1);
  });

  it('ensures background rectangle fully covers canvas across camera edge positions', () => {
    const width = 844;
    const height = 390;
    const zoom = arenaZoom(width, height);
    const halfView = width / (2 * zoom);
    const maxLimit = Math.max(0, STAGE_HALF_WIDTH - halfView);

    for (const camX of [-maxLimit, 0, maxLimit]) {
      const layout = stageLayout(width, height, zoom, 9 / 16, GROUND_SCREEN_RATIO);

      for (const shakeX of [-CAMERA_SHAKE_MARGIN, 0, CAMERA_SHAKE_MARGIN]) {
        const screenLeft = width / 2 + (layout.x - camX) * zoom + shakeX;
        const screenRight = screenLeft + layout.width * zoom;

        expect(screenLeft).toBeLessThanOrEqual(0.01);
        expect(screenRight).toBeGreaterThanOrEqual(width - 0.01);
      }
    }
  });

  it('advances walk stride phase even when blocked against a wall or opponent with zero dx', () => {
    const mockFighter: FighterState = {
      id: 'amper',
      x: -500, // stuck against wall
      y: 0,
      vx: 0,
      vy: 0,
      facing: -1,
      state: 'walk_fwd',
      stateTicks: 0,
      hp: 1000,
      maxHp: 1000,
      meter: 0,
      currentMove: null,
      moveTick: 0,
      hitstop: 0,
      isGrounded: true,
      comboHits: 0,
      lastHitBy: null,
      hasHit: false,
      stunTicks: 0,
      juggleHits: 0,
    };

    let pose = locomotionPose(undefined, mockFighter, 0, false);
    expect(pose.clip).toBe('walk_start');

    // Simulate 10 ticks where fighter position x does NOT change (stuck at wall)
    for (let t = 1; t <= 10; t++) {
      pose = locomotionPose(pose, mockFighter, t, false);
    }

    // Phase must have advanced rather than remaining frozen at 0
    expect(pose.phase).toBeGreaterThan(0);
  });
});
