import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { describe, expect, it, vi } from 'vitest';
import catalog from '../assets/assetCatalog.json';
import { environmentAssets } from '../assets/assetManifest';
import { disposeObjectTree } from '../lifecycle/disposeThree';
import { allTentLayout, tentColliderBounds } from './campLayout';
import { ROCK_SHOP_SITE } from './festivalLandmarks';
import { FESTIVAL_WHEEL_SITE } from './festivalWheel';
import { MARKET_LANE, MARKET_STALL_LAYOUT, marketColliderBounds } from './festivalMarket';
import {
  createZoneGrassMask,
  FESTIVAL_ZONE_IDS,
  FESTIVAL_ZONE_SITES,
  festivalZoneTemplates,
  placeFestivalZones,
  zoneBounds,
} from './festivalZones';
import { terrainHeight } from './terrainHeight';

async function load() {
  const bytes = readFileSync(
    new URL(`../../../public/game-assets/${catalog.environment.festivalZones}`, import.meta.url),
  );
  expect(bytes.length).toBeLessThan(1800000);
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'test-images', loadTexture: () => Promise.resolve(new THREE.Texture()) }));
  return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
}
function firstMesh(root: THREE.Object3D) {
  let result: THREE.Mesh | undefined;
  root.traverse((o) => {
    if (o instanceof THREE.Mesh && !result) result = o;
  });
  return result!;
}
const overlap = (a: ReturnType<typeof zoneBounds>, b: ReturnType<typeof zoneBounds>) =>
  a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;

describe('festival partner zone prototypes', () => {
  it('loads all three native-metre prototypes with textured PBR, bounded geometry and explicit provenance', async () => {
    expect(environmentAssets.festivalZones).toContain('world/festival/festivalZones.glb');
    const source = await load();
    try {
      const templates = festivalZoneTemplates(source);
      expect([...templates.keys()].sort()).toEqual([...FESTIVAL_ZONE_IDS].sort());
      expect(source.animations).toHaveLength(0);
      const counts: Record<string, number> = {};
      for (const [id, root] of templates) {
        const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
        const width = { pomorze: 16.6, redBull: 11, iqos: 8.8 }[id];
        expect(size.x).toBeGreaterThan(width - 0.1);
        expect(size.x).toBeLessThan(width + 0.2);
        expect(size.y).toBeGreaterThan(3);
        expect(size.y).toBeLessThan(7);
        expect(root.userData.source).toMatch(/^https:\/\//);
        expect(root.userData.referenceStatus).toContain(id === 'pomorze' ? 'photo-led' : 'provisional');
        let meshes = 0,
          triangles = 0,
          maps = 0;
        root.traverse((o) => {
          expect(o instanceof THREE.Light).toBe(false);
          if (!(o instanceof THREE.Mesh)) return;
          meshes++;
          triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
          const mat = o.material as THREE.MeshStandardMaterial;
          expect(mat.isMeshStandardMaterial).toBe(true);
          if (mat.map) maps++;
        });
        expect(meshes).toBeLessThanOrEqual(14);
        expect(maps).toBeGreaterThan(0);
        expect(triangles).toBeLessThan(40000);
        counts[id] = triangles;
      }
      expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBeLessThan(50000);
    } finally {
      disposeObjectTree(source.scene);
    }
  });

  it('grounds clones, resets library offsets, shares resources and covers visible geometry with colliders', async () => {
    const source = await load(),
      parent = new THREE.Group();
    try {
      const templates = festivalZoneTemplates(source);
      const before = [...templates.values()].map((o) => o.matrix.toArray());
      const boxes = placeFestivalZones(parent, templates, terrainHeight);
      expect(boxes).toHaveLength(6);
      expect(FESTIVAL_ZONE_SITES.filter((s) => s.id === 'redBull')).toHaveLength(4);
      expect(new Set(parent.children.map((o) => o.userData.campObject.id)).size).toBe(6);
      parent.updateMatrixWorld(true);
      const mask = createZoneGrassMask(new Set(templates.keys()));
      for (const [i, site] of FESTIVAL_ZONE_SITES.entries()) {
        const root = parent.children[i],
          box = boxes[i];
        expect(root.position.x).toBe(site.x);
        expect(root.position.z).toBe(site.z);
        expect(root.userData.exteriorOnly).toBe(true);
        expect(root.userData.vendor.position).toBe('review-layout-not-surveyed');
        expect(root.userData.vendor.source).toBe(root.userData.source);
        const bounds = new THREE.Box3().setFromObject(root);
        expect(bounds.min.x).toBeGreaterThanOrEqual(box.min.x);
        expect(bounds.max.x).toBeLessThanOrEqual(box.max.x);
        expect(bounds.min.z).toBeGreaterThanOrEqual(box.min.z);
        expect(bounds.max.z).toBeLessThanOrEqual(box.max.z);
        for (let x = bounds.min.x; x <= bounds.max.x; x += 0.25)
          for (let z = bounds.min.z; z <= bounds.max.z; z += 0.25) {
            expect(bounds.min.y - terrainHeight(x, z)).toBeGreaterThan(0.02);
            expect(mask(x, z)).toBe(0);
          }
        const mesh = firstMesh(root),
          cached = firstMesh(templates.get(site.id)!);
        expect(mesh.geometry).toBe(cached.geometry);
        expect(mesh.material).toBe(cached.material);
      }
      expect([...templates.values()].map((o) => o.matrix.toArray())).toEqual(before);
      const mesh = firstMesh(parent.children[0]);
      const spy = vi.spyOn(mesh.geometry, 'dispose');
      parent.add(source.scene);
      disposeObjectTree(parent);
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      if (parent.children.length) {
        parent.add(source.scene);
        disposeObjectTree(parent);
      }
    }
  });

  it('does not overlap tents, other landmarks or the market customer lane', () => {
    const fixed = [ROCK_SHOP_SITE, FESTIVAL_WHEEL_SITE].map((s) => ({
      minX: s.x - s.halfWidth,
      maxX: s.x + s.halfWidth,
      minZ: s.z - s.halfDepth,
      maxZ: s.z + s.halfDepth,
    }));
    for (const site of FESTIVAL_ZONE_SITES) {
      const b = zoneBounds(site);
      expect(Math.max(Math.abs(b.minX), Math.abs(b.maxX), Math.abs(b.minZ), Math.abs(b.maxZ))).toBeLessThan(
        54,
      );
      for (const tent of allTentLayout)
        expect(overlap(b, tentColliderBounds(tent)), `${site.id}/${tent.id}`).toBe(false);
      for (const other of FESTIVAL_ZONE_SITES)
        if (other.instanceId !== site.instanceId) expect(overlap(b, zoneBounds(other))).toBe(false);
      for (const other of [...fixed, ...MARKET_STALL_LAYOUT.map(marketColliderBounds), MARKET_LANE])
        expect(overlap(b, other), site.id).toBe(false);
    }
  });

  it('handles missing and partial libraries without ghost footprints or collisions', async () => {
    const parent = new THREE.Group();
    expect(festivalZoneTemplates(null).size).toBe(0);
    expect(placeFestivalZones(parent, new Map(), terrainHeight)).toEqual([]);
    expect(parent.children).toHaveLength(0);
    const source = await load();
    try {
      const partial = new Map([['pomorze' as const, festivalZoneTemplates(source).get('pomorze')!]]);
      expect(placeFestivalZones(parent, partial, terrainHeight)).toHaveLength(1);
      const mask = createZoneGrassMask(new Set(partial.keys()));
      for (const site of FESTIVAL_ZONE_SITES) {
        expect(mask(site.x, site.z)).toBe(site.id === 'pomorze' ? 0 : 1);
        expect(createZoneGrassMask(new Set())(site.x, site.z)).toBe(1);
      }
      expect(mask(0, 43 + 3.2 + 0.125)).toBeCloseTo(0.5);
    } finally {
      parent.add(source.scene);
      disposeObjectTree(parent);
    }
  });

  it('has six low anchored arms, a tall central peak and an unobstructed visual opening', async () => {
    const source = await load();
    try {
      const root = festivalZoneTemplates(source).get('redBull')!.clone(true);
      root.position.set(0, 0, 0);
      root.updateMatrixWorld(true);
      const anchors = new Set<number>();
      let highest = 0;
      root.traverse((o) => {
        if (!(o instanceof THREE.Mesh) || (o.material as THREE.Material).name !== 'RedBull_Star_Canvas')
          return;
        const p = o.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const v = new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
          highest = Math.max(highest, v.y);
          if (v.y < 0.1 && Math.hypot(v.x, v.z) > 5.3)
            anchors.add((Math.round(Math.atan2(v.z, v.x) / (Math.PI / 3)) + 6) % 6);
        }
      });
      expect(anchors.size).toBe(6);
      expect(highest).toBeGreaterThan(5.65);
      const ray = new THREE.Raycaster(new THREE.Vector3(1, 1.9, 5), new THREE.Vector3(0, 0, -1), 0, 3);
      expect(ray.intersectObject(root, true)).toHaveLength(0);
    } finally {
      disposeObjectTree(source.scene);
    }
  });
});
