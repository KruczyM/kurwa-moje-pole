import { describe, expect, it } from 'vitest';
import { AfterCampaign } from '../AfterCampaign';
import { SpriteAnimator, type SpriteMetadata } from './SpriteAnimator';
import { CameraRig } from './CameraRig';
import { AfterPresentation } from './AfterPresentation';

const meta: SpriteMetadata = {
  frameWidth: 64,
  frameHeight: 64,
  framesPerDirection: 4,
  rows: { down: 0, right: 1, up: 2, left: 3 },
  animationColumns: { idle: [0], walk: [0, 1, 2, 3] },
};

describe('After presentation', () => {
  it('maps every simulation direction to the authored atlas rows', () => {
    const animator = new SpriteAnimator(meta);
    for (const [facing, row] of [
      ['south', 0],
      ['east', 1],
      ['north', 2],
      ['west', 3],
    ] as const)
      expect(animator.update(0, facing, false)).toEqual({ x: 0, y: row * 64, width: 64, height: 64 });
  });

  it('loops independently of frame rate and keeps gait while turning', () => {
    const a = new SpriteAnimator(meta);
    const b = new SpriteAnimator(meta);
    for (let i = 0; i < 60; i++) a.update(1 / 60, 'south', true);
    for (let i = 0; i < 30; i++) b.update(1 / 30, 'south', true);
    expect(a.update(0, 'south', true)).toEqual(b.update(0, 'south', true));
    expect(a.update(0.125, 'east', true)).toEqual({ x: 64, y: 64, width: 64, height: 64 });
    expect(a.update(0, 'north', true).x).toBe(64);
  });

  it('freezes during pause, resets idle, and bounds invalid or hidden-tab deltas', () => {
    const animator = new SpriteAnimator(meta);
    const frame = animator.update(0.125, 'south', true);
    expect(animator.update(10, 'south', false, false, true)).toEqual(frame);
    expect(animator.update(NaN, 'south', true)).toEqual(frame);
    expect(animator.update(0, 'south', false).x).toBe(0);
    expect(animator.update(100, 'south', true).x).toBe(128);
  });

  it('rejects bad atlas data and owns an independent copy', () => {
    expect(() => new SpriteAnimator({ ...meta, frameWidth: 0 })).toThrow();
    expect(() => new SpriteAnimator({ ...meta, animationColumns: { idle: [0], walk: [4] } })).toThrow();
    const copy = structuredClone(meta);
    const animator = new SpriteAnimator(copy);
    copy.rows.down = 7;
    expect(animator.update(0, 'south', false).y).toBe(0);
  });

  it('centers small maps, clamps edges and responds to orientation changes', () => {
    const camera = new CameraRig({ width: 24, height: 18 });
    camera.resize({ width: 640, height: 480, pixelsPerMeter: 64 });
    camera.follow({ x: 0, y: 0 }, 0);
    expect(camera.project({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    camera.resize({ width: 2000, height: 1600, pixelsPerMeter: 64 });
    expect(camera.project({ x: 12, y: 9 })).toEqual({ x: 1000, y: 800 });
    expect(() => camera.resize({ width: 0, height: 100, pixelsPerMeter: 64 })).toThrow();
  });

  it('camera smoothing is time based and pauses without drift', () => {
    const make = () => {
      const camera = new CameraRig({ width: 100, height: 100 });
      camera.resize({ width: 320, height: 320, pixelsPerMeter: 64 });
      camera.follow({ x: 10, y: 10 }, 0);
      return camera;
    };
    const a = make(),
      b = make();
    for (let i = 0; i < 60; i++) a.follow({ x: 20, y: 20 }, 1 / 60);
    for (let i = 0; i < 30; i++) b.follow({ x: 20, y: 20 }, 1 / 30);
    expect(a.project({ x: 20, y: 20 }).x).toBeCloseTo(b.project({ x: 20, y: 20 }).x, 8);
    const before = a.project({ x: 20, y: 20 });
    a.follow({ x: 90, y: 90 }, 1, true);
    expect(a.project({ x: 20, y: 20 })).toEqual(before);
  });

  it('interpolates feet without mutating snapshots and sorts players deterministically', () => {
    const campaign = new AfterCampaign();
    campaign.addPlayer('b', 'Amper');
    campaign.addPlayer('a', 'Chlebak');
    const world = campaign.snapshot().world;
    for (const player of world.players) {
      player.previousPosition = { x: 5, y: 5 };
      player.position = { x: 6, y: 6 };
    }
    const original = structuredClone(world);
    const camera = new CameraRig({ width: 24, height: 18 });
    const presentation = new AfterPresentation(camera, () => meta);
    const players = presentation.update(world, 0.5, 1 / 60, 'a');
    expect(players.map((player) => player.slotId)).toEqual(['a', 'b']);
    expect(players[0].feet).toEqual({ x: 5.5, y: 5.5 });
    expect(world).toEqual(original);
    expect(presentation.update(world, 0, 1, 'a', true)[0].feet).toEqual({ x: 6, y: 6 });
    world.players = [];
    expect(presentation.update(world, 0, 0, 'a')).toEqual([]);
    presentation.dispose();
    expect(presentation.update(original, 1, 0, 'a')[0].frame.x).toBe(0);
  });
});
