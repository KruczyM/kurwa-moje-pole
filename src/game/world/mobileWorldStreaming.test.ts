import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { FogSectorStreamer, type FogSector } from './FogSectorStreamer';
import {
  CAMP_LOAD_DISTANCE,
  CAMP_RETAIN_DISTANCE,
  isDeferredCampSector,
  mobileOpenWorldEnabled,
  mobileWorldRanges,
} from './mobileWorldStreaming';

/** Creates a sector fixture without depending on large binary game assets. */
function sector(id: string, x: number, z: number): FogSector {
  return {
    id,
    path: `${id}.glb`,
    bytes: 1,
    bounds: [
      [x, 0, z],
      [x + 16, 3, z + 16],
    ],
  };
}

describe('mobile open world', () => {
  it('enables mobile independently of stale fog query/settings, with explicit desktop opt-in', () => {
    expect(mobileOpenWorldEnabled(true, '?fogTrial=0')).toBe(true);
    expect(mobileOpenWorldEnabled(false, '')).toBe(false);
    expect(mobileOpenWorldEnabled(false, '?mobileWorld=1')).toBe(true);
  });

  it('defers only the northern camp row, not the main camp, passages or stage', () => {
    expect(isDeferredCampSector(sector('camp', -112, -144))).toBe(true);
    expect(isDeferredCampSector(sector('main', 0, 0))).toBe(false);
    expect(isDeferredCampSector(sector('road', 0, -40))).toBe(false);
    expect(isDeferredCampSector(sector('stage', 180, -144))).toBe(false);
    expect(
      isDeferredCampSector({
        ...sector('ground', 0, 0),
        bounds: [
          [-260, 0, -260],
          [260, 0, 260],
        ],
      }),
    ).toBe(false);
    expect(mobileWorldRanges(sector('main', 0, 0)).retain).toBe(Infinity);
    expect(mobileWorldRanges(sector('camp', -112, -144)).prefetch).toBe(CAMP_LOAD_DISTANCE);
  });

  it('primes the rest of the world but fetches a remote camp only after approach', async () => {
    const main = sector('main', 0, 0);
    const stage = sector('stage', 180, 0);
    const camp = sector('camp', 0, -144);
    const scene = new THREE.Group();
    const load = vi.fn(async (entry: FogSector) => {
      const root = new THREE.Group();
      root.name = entry.id;
      return root;
    });
    const release = vi.fn((_entry: FogSector, root: THREE.Object3D) => root.removeFromParent());
    const stream = new FogSectorStreamer(
      scene,
      { schema: 1, sourceSha256: '', sectors: [main, stage, camp] },
      load,
      release,
      vi.fn(),
    );
    stream.setStreamingPolicy(mobileWorldRanges);
    await stream.prime(new THREE.Vector3());
    expect(load.mock.calls.map(([entry]) => entry.id)).toEqual(['main', 'stage']);
    expect(scene.children.every((root) => root.visible)).toBe(true);
    await stream.prime(new THREE.Vector3(0, 0, -128 + CAMP_LOAD_DISTANCE));
    expect(load.mock.calls.map(([entry]) => entry.id)).toEqual(['main', 'stage', 'camp']);
    stream.update(1, new THREE.Vector3(0, 0, -128 + CAMP_RETAIN_DISTANCE - 1));
    expect(release).not.toHaveBeenCalled();
    stream.update(1, new THREE.Vector3());
    expect(release).toHaveBeenCalledTimes(1);
    expect(scene.children.map((root) => root.name)).toEqual(['main', 'stage']);
    stream.dispose();
    expect(release).toHaveBeenCalledTimes(3);
  });

  it('releases an in-flight camp result after moving away, keeping a single queue', async () => {
    const camp = sector('camp', 0, -144);
    let finish!: (root: THREE.Object3D) => void;
    const load = vi.fn(
      () =>
        new Promise<THREE.Object3D>((resolve) => {
          finish = resolve;
        }),
    );
    const release = vi.fn();
    const stream = new FogSectorStreamer(
      new THREE.Group(),
      { schema: 1, sourceSha256: '', sectors: [camp] },
      load,
      release,
      vi.fn(),
    );
    stream.setStreamingPolicy(mobileWorldRanges);
    stream.update(1, new THREE.Vector3(0, 0, -130));
    stream.update(1, new THREE.Vector3(0, 0, -130));
    expect(load).toHaveBeenCalledOnce();
    stream.update(1, new THREE.Vector3());
    finish(new THREE.Group());
    await Promise.resolve();
    await Promise.resolve();
    expect(release).toHaveBeenCalledOnce();
    expect(stream.stats.loaded).toBe(0);
    stream.dispose();
  });
});
