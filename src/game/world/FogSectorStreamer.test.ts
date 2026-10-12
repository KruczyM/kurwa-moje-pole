import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import {
  FogSectorStreamer,
  sectorDistance,
  mobileAreaAt,
  mobileSectorArea,
  type FogSector,
} from './FogSectorStreamer';

const sector = (id: string, x = 0): FogSector => ({
  id,
  path: `${id}.glb`,
  bytes: 1,
  bounds: [
    [x, 0, 0],
    [x + 2, 3, 2],
  ],
});

describe('mobile map transitions', () => {
  const manifest = {
    schema: 1,
    sourceSha256: '',
    cellSize: 16,
    sectors: [sector('0_0'), sector('3_3', 48), sector('4_0', 64), sector('-1_0', -16)],
  };
  const setup = (
    load = vi.fn<(sector: FogSector) => Promise<THREE.Group>>(async () => new THREE.Group()),
  ) => {
    const scene = new THREE.Group();
    const release = vi.fn((_sector: FogSector, root: THREE.Object3D) => root.removeFromParent());
    const stream = new FogSectorStreamer(scene, manifest, load, release, vi.fn(), true);
    return { stream, scene, load, release };
  };

  it('uses a stable grid, including negative positions and exact boundaries', () => {
    expect(mobileAreaAt(new THREE.Vector3(63.99, 100, 0))).toBe('0_0');
    expect(mobileAreaAt(new THREE.Vector3(64, 0, -0.01))).toBe('1_-1');
    expect(mobileAreaAt(new THREE.Vector3(-64, 0, 0))).toBe('-1_0');
    expect(mobileAreaAt(new THREE.Vector3(32, 0, 0), 8)).toBe('1_0');
    expect(mobileSectorArea(sector('-1_-4'))).toBe('-1_-1');
    expect(() => mobileSectorArea(sector('invalid'))).toThrow();
  });

  it('primes every model in the starting area and never prefetches other areas', async () => {
    const { stream, load, scene } = setup();
    await stream.prime(new THREE.Vector3());
    expect(load.mock.calls.map(([s]) => s.id)).toEqual(['0_0', '3_3']);
    expect(scene.children).toHaveLength(2);
    stream.setViewDistance(30);
    stream.update(5, new THREE.Vector3(100, 0, 0));
    await Promise.resolve();
    expect(load).toHaveBeenCalledTimes(2);
    expect(stream.activeArea).toBe('0_0');
  });

  it('evicts all previous models before requesting the next map, and supports returning', async () => {
    const { stream, load, release, scene } = setup();
    await stream.prime(new THREE.Vector3());
    load.mockImplementation(async () => {
      expect(scene.children).toHaveLength(0);
      expect(release).toHaveBeenCalledTimes(2);
      return new THREE.Group();
    });
    const progress = vi.fn();
    await stream.enterArea('1_0', progress);
    expect(progress.mock.calls).toEqual([
      [0, 1],
      [1, 1],
    ]);
    expect(stream.activeArea).toBe('1_0');
    expect(scene.children).toHaveLength(1);
    load.mockImplementation(async () => new THREE.Group());
    await stream.enterArea('0_0');
    expect(release).toHaveBeenCalledTimes(3);
    expect(scene.children).toHaveLength(2);
    expect(load).toHaveBeenCalledTimes(5);
  });

  it('cleans up a partially loaded map after failure and permits retry', async () => {
    const { stream, load, release, scene } = setup();
    load.mockResolvedValueOnce(new THREE.Group()).mockRejectedValueOnce(new Error('Offline'));
    await expect(stream.enterArea('0_0')).rejects.toThrow('Offline');
    expect(scene.children).toHaveLength(0);
    expect(release).toHaveBeenCalledOnce();
    expect(stream.activeArea).toBeUndefined();
    expect(stream.stats.pending).toBe(false);
    await stream.enterArea('0_0');
    expect(stream.activeArea).toBe('0_0');
    expect(stream.stats.loaded).toBe(2);
  });

  it('serializes downloads and releases an in-flight result after disposal', async () => {
    let finish!: (root: THREE.Group) => void;
    const { stream, load, release, scene } = setup(
      vi.fn(
        () =>
          new Promise<THREE.Group>((resolve) => {
            finish = resolve;
          }),
      ),
    );
    const pending = stream.enterArea('0_0');
    await expect(stream.enterArea('1_0')).rejects.toThrow('Trwa już');
    stream.dispose();
    finish(new THREE.Group());
    await pending;
    expect(load).toHaveBeenCalledOnce();
    expect(release).toHaveBeenCalledOnce();
    expect(scene.children).toHaveLength(0);
    expect(stream.activeArea).toBeUndefined();
  });

  it('allows empty areas without getting stuck loading or asking on every frame', async () => {
    const { stream, load, release } = setup();
    await stream.prime(new THREE.Vector3());
    await stream.enterArea('10_10');
    expect(stream.activeArea).toBe('10_10');
    expect(stream.stats.loaded).toBe(0);
    await stream.enterArea('10_10');
    expect(load).toHaveBeenCalledTimes(2);
    expect(release).toHaveBeenCalledTimes(2);
  });
});
describe('FogSectorStreamer', () => {
  it('expands streaming live and releases sectors after the user reduces the distance', async () => {
    const root = new THREE.Group(),
      release = vi.fn();
    const stream = new FogSectorStreamer(
      new THREE.Group(),
      { schema: 1, sourceSha256: '', sectors: [sector('a', 24)] },
      async () => root,
      release,
      vi.fn(),
    );
    await stream.prime(new THREE.Vector3());
    expect(stream.stats.loaded).toBe(0);
    stream.setViewDistance(30);
    await stream.prime(new THREE.Vector3());
    expect(root.visible).toBe(true);
    stream.setViewDistance(8);
    stream.update(0, new THREE.Vector3());
    expect(release).toHaveBeenCalledOnce();
    expect(stream.stats.loaded).toBe(0);
  });
  it('measures the nearest bounds edge, not origin or height', () => {
    expect(sectorDistance(sector('a'), new THREE.Vector3(1, 100, 1))).toBe(0);
    expect(sectorDistance(sector('a'), new THREE.Vector3(5, 0, 6))).toBe(5);
  });
  it('primes nearby models and really releases them after moving away', async () => {
    const root = new THREE.Group(),
      scene = new THREE.Group();
    const release = vi.fn((_s, object) => object.removeFromParent());
    const stream = new FogSectorStreamer(
      scene,
      { schema: 1, sourceSha256: '', sectors: [sector('a')] },
      async () => root,
      release,
      vi.fn(),
    );
    await stream.prime(new THREE.Vector3());
    expect(scene.children).toContain(root);
    stream.update(1, new THREE.Vector3(100, 0, 0));
    expect(release).toHaveBeenCalledOnce();
    expect(scene.children).toHaveLength(0);
    stream.dispose();
    expect(release).toHaveBeenCalledOnce();
  });
  it('shares one pending request between prime and runtime, releases late results on dispose', async () => {
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
      { schema: 1, sourceSha256: '', sectors: [sector('a'), sector('b')] },
      load,
      release,
      vi.fn(),
    );
    const primed = stream.prime(new THREE.Vector3());
    stream.update(1, new THREE.Vector3());
    expect(load).toHaveBeenCalledOnce();
    stream.dispose();
    finish(new THREE.Group());
    await primed;
    expect(release).toHaveBeenCalledOnce();
    expect(stream.stats.loaded).toBe(0);
  });
  it('does not retry a failed sector forever while priming', async () => {
    const load = vi.fn(async () => null),
      warn = vi.fn();
    const stream = new FogSectorStreamer(
      new THREE.Group(),
      { schema: 1, sourceSha256: '', sectors: [sector('a')] },
      load,
      vi.fn(),
      warn,
    );
    await stream.prime(new THREE.Vector3());
    await stream.prime(new THREE.Vector3());
    expect(load).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledOnce();
    expect(stream.stats.failed).toBe(1);
  });
  it('prefetches hidden sectors and drops requests completed outside the retention radius', async () => {
    const root = new THREE.Group(),
      scene = new THREE.Group();
    let finish!: (root: THREE.Object3D) => void;
    const release = vi.fn();
    const stream = new FogSectorStreamer(
      scene,
      { schema: 1, sourceSha256: '', sectors: [sector('a', 17)] },
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
      release,
      vi.fn(),
    );
    stream.update(1, new THREE.Vector3());
    stream.update(1, new THREE.Vector3(100, 0, 0));
    finish(root);
    await Promise.resolve();
    await Promise.resolve();
    expect(release).toHaveBeenCalledOnce();
    expect(scene.children).toHaveLength(0);
  });
});
