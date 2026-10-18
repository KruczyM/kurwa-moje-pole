import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { readFileSync } from 'node:fs';
import catalog from './assetCatalog.json';
import { festivalNpcAssets } from './assetManifest';
import { AssetLoader } from './AssetLoader';
import { disposeObjectTree } from '../lifecycle/disposeThree';
import { NpcAnimator } from '../npc/NpcAnimator';

afterEach(() => vi.restoreAllMocks());

describe('festival crowd asset pipeline', () => {
  it('parses all 91 catalog files with the runtime GLTFLoader and finds visible finite geometry', async () => {
    expect(festivalNpcAssets).toHaveLength(91);
    expect(new Set(festivalNpcAssets.map((a) => a.url)).size).toBe(91);
    const loader = new GLTFLoader();
    loader.register(() => ({ name: 'test-images', loadTexture: () => Promise.resolve(new THREE.Texture()) }));
    for (const asset of catalog.festivalNpcs) {
      const bytes = readFileSync(new URL(`../../../public/game-assets/${asset.path}`, import.meta.url));
      expect(bytes.toString('ascii', 0, 4), asset.id).toBe('glTF');
      expect(bytes.readUInt32LE(8)).toBe(bytes.length);
      const json = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
      expect(json.meshes.length, asset.id).toBeGreaterThan(0);
      const model = await loader.parseAsync(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
        '',
      );
      try {
        const bounds = new THREE.Box3().setFromObject(model.scene);
        expect(bounds.isEmpty(), asset.id).toBe(false);
        const size = bounds.getSize(new THREE.Vector3());
        expect(
          size.toArray().every((value) => Number.isFinite(value) && value > 0),
          asset.id,
        ).toBe(true);
        const skins: THREE.SkinnedMesh[] = [];
        model.scene.traverse((object) => {
          if (object instanceof THREE.SkinnedMesh) skins.push(object);
        });
        expect(skins.length, `${asset.id}: missing skinned mesh`).toBeGreaterThan(0);
        expect(
          model.animations.map((clip) => clip.name),
          asset.id,
        ).toEqual(expect.arrayContaining(['Idle', 'Walk', 'Run']));
        const animator = new NpcAnimator(model.scene, model.animations, {
          fadeSeconds: 0,
          minimumStateSeconds: { Idle: 0, Walk: 0, Run: 0 },
        });
        let moved = false;
        const initial = new Map<string, THREE.Vector3>();
        for (const clip of ['Walk', 'Run'] as const) {
          animator.play(clip);
          for (let frame = 0; frame < 4; frame++) {
            animator.update(0.19);
            model.scene.updateMatrixWorld(true);
            for (const mesh of skins) {
              mesh.skeleton.update();
              const count = mesh.geometry.getAttribute('position').count;
              const stride = Math.max(1, Math.floor(count / 100));
              for (let vertex = 0; vertex < count; vertex += stride) {
                const point = mesh
                  .getVertexPosition(vertex, new THREE.Vector3())
                  .applyMatrix4(mesh.matrixWorld);
                expect(point.toArray().every(Number.isFinite), `${asset.id}: invalid deformation`).toBe(true);
                expect(point.length(), `${asset.id}: exploding skin`).toBeLessThan(8);
                const key = `${mesh.uuid}/${vertex}`;
                const rest = initial.get(key);
                if (rest && point.distanceTo(rest) > 0.005) moved = true;
                if (!rest) initial.set(key, point.clone());
              }
            }
          }
        }
        animator.dispose();
        expect(moved, `${asset.id}: skeleton does not deform geometry`).toBe(true);
      } finally {
        disposeObjectTree(model.scene);
      }
    }
  }, 30000);

  it('streams the whole catalog with bounded concurrency and continues after a failed file', async () => {
    let active = 0,
      maximum = 0,
      calls = 0;
    vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(async () => {
      const index = calls++;
      active++;
      maximum = Math.max(maximum, active);
      await Promise.resolve();
      active--;
      if (index === 4) throw new Error('missing model');
      return { scene: new THREE.Group(), animations: [] } as unknown as GLTF;
    });
    const accepted: string[] = [];
    const error = vi.fn();
    const loader = new AssetLoader(vi.fn(), error, null);
    const result = await loader.loadFestivalNpcs(
      (asset) => {
        accepted.push(asset.id);
        return true;
      },
      () => false,
    );
    expect(maximum).toBe(2);
    expect(calls).toBe(91);
    expect(new Set(accepted).size).toBe(90);
    expect(result).toEqual({ loaded: 90, failed: 1, total: 91 });
    expect(error).toHaveBeenCalledTimes(1);
  });

  it('stops scheduling after cancellation and disposes assets which arrive too late', async () => {
    let cancelled = false;
    const geometry = new THREE.BoxGeometry();
    const dispose = vi.spyOn(geometry, 'dispose');
    vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(async () => {
      const scene = new THREE.Group();
      scene.add(new THREE.Mesh(geometry));
      await Promise.resolve();
      cancelled = true;
      return { scene, animations: [] } as unknown as GLTF;
    });
    const accept = vi.fn();
    await new AssetLoader(vi.fn(), vi.fn(), null).loadFestivalNpcs(accept, () => cancelled);
    expect(accept).not.toHaveBeenCalled();
    expect(GLTFLoader.prototype.loadAsync).toHaveBeenCalledTimes(2);
    expect(dispose).toHaveBeenCalledTimes(2);
  });
});
