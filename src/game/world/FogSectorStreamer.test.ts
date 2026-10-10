import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { FogSectorStreamer, sectorDistance, type FogSector } from './FogSectorStreamer';

const sector = (id: string, x = 0): FogSector => ({
  id,
  path: `${id}.glb`,
  bytes: 1,
  bounds: [
    [x, 0, 0],
    [x + 2, 3, 2],
  ],
});
describe('FogSectorStreamer', () => {
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
