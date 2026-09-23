import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import {
  allTentLayout,
  festivalTentLayout,
  prototypeTentLayout,
  sampleTentGrassMask,
  tentColliderBounds,
} from './campLayout';
import {
  CAMP_PALETTES,
  createFestivalCamp,
  FESTIVAL_CAMP_ROADS,
  FESTIVAL_CAMP_SECTORS,
  sampleFestivalRoadMask,
  tentTerrainOffset,
} from './festivalCamping';
import { TentPaletteCache } from './tentPalettes';
import { disposeObjectTree } from '../lifecycle/disposeThree';
import { ROCK_SHOP_SITE } from './festivalLandmarks';
import { FESTIVAL_WHEEL_SITE } from './festivalWheel';
import { MARKET_STALL_LAYOUT, marketColliderBounds } from './festivalMarket';
import { FESTIVAL_ZONE_SITES, zoneBounds } from './festivalZones';

const overlap = (a: ReturnType<typeof tentColliderBounds>, b: ReturnType<typeof tentColliderBounds>) =>
  a.maxX > b.minX && a.minX < b.maxX && a.maxZ > b.minZ && a.minZ < b.maxZ;

describe('festival camping staging sectors', () => {
  it('keeps intersections bare even inside the feathered edge of another lane', () => {
    expect(sampleFestivalRoadMask(33.9, 30)).toBe(0);
    expect(sampleFestivalRoadMask(33.9, 26)).toBeCloseTo(0.4);
  });
  it('creates a deterministic, varied layout without mutating templates', () => {
    const before = JSON.stringify(prototypeTentLayout);
    const first = createFestivalCamp(prototypeTentLayout, [], 2026);
    expect(first).toEqual(createFestivalCamp(prototypeTentLayout, [], 2026));
    expect(first).not.toEqual(createFestivalCamp(prototypeTentLayout, [], 2027));
    expect(first).toHaveLength(48);
    expect(festivalTentLayout.length).toBeGreaterThan(30);
    expect(festivalTentLayout.length).toBeLessThan(47); // Passage now reserves its full roadside area.
    expect(allTentLayout).toHaveLength(festivalTentLayout.length + 19);
    expect(new Set(festivalTentLayout.map((t) => t.model)).size).toBe(4);
    expect(new Set(festivalTentLayout.map((t) => t.palette)).size).toBe(6);
    expect(new Set(allTentLayout.map((t) => t.id)).size).toBe(allTentLayout.length);
    expect(JSON.stringify(prototypeTentLayout)).toBe(before);
    expect(createFestivalCamp([], [])).toEqual([]);
  });

  it('keeps footprints within sectors, outside roads and away from all other tents', () => {
    for (const tent of festivalTentLayout) {
      const box = tentColliderBounds(tent);
      expect(
        FESTIVAL_CAMP_SECTORS.some(
          (s) => box.minX > s.minX && box.maxX < s.maxX && box.minZ > s.minZ && box.maxZ < s.maxZ,
        ),
      ).toBe(true);
      for (const road of FESTIVAL_CAMP_ROADS) {
        const buffered = {
          minX: box.minX - 0.5,
          maxX: box.maxX + 0.5,
          minZ: box.minZ - 0.5,
          maxZ: box.maxZ + 0.5,
        };
        expect(overlap(buffered, road)).toBe(false);
        expect(sampleFestivalRoadMask((road.minX + road.maxX) / 2, (road.minZ + road.maxZ) / 2)).toBe(0);
      }
      for (const other of allTentLayout) {
        if (other.id !== tent.id) expect(overlap(box, tentColliderBounds(other))).toBe(false);
      }
    }
  });

  it('every entrance approach can be reached from the original camp on a 0.5 m grid', () => {
    const boxes = allTentLayout.map(tentColliderBounds);
    boxes.push(...MARKET_STALL_LAYOUT.map(marketColliderBounds));
    boxes.push(...FESTIVAL_ZONE_SITES.map(zoneBounds));
    for (const site of [ROCK_SHOP_SITE, FESTIVAL_WHEEL_SITE]) {
      boxes.push({
        minX: site.x - site.halfWidth,
        maxX: site.x + site.halfWidth,
        minZ: site.z - site.halfDepth,
        maxZ: site.z + site.halfDepth,
      });
    }
    const key = (x: number, z: number) => `${x},${z}`;
    const blocked = (x: number, z: number) =>
      boxes.some((b) => x > b.minX - 0.45 && x < b.maxX + 0.45 && z > b.minZ - 0.45 && z < b.maxZ + 0.45);
    const queue: [number, number][] = [[0, 0]];
    const visited = new Set(['0,0']);
    for (let head = 0; head < queue.length; head++) {
      const [x, z] = queue[head];
      for (const [dx, dz] of [
        [0.5, 0],
        [-0.5, 0],
        [0, 0.5],
        [0, -0.5],
      ]) {
        const nx = x + dx,
          nz = z + dz,
          id = key(nx, nz);
        if (Math.abs(nx) > 54 || Math.abs(nz) > 54 || visited.has(id) || blocked(nx, nz)) continue;
        visited.add(id);
        queue.push([nx, nz]);
      }
    }
    for (const stall of MARKET_STALL_LAYOUT) {
      expect(
        visited.has(key(stall.x + (stall.variant === 'siemaShop' ? 10 : 4), Math.round(stall.z * 2) / 2)),
        stall.id,
      ).toBe(true);
    }
    for (const site of FESTIVAL_ZONE_SITES) {
      const reach = site.id === 'redBull' ? site.halfWidth + 1 : site.halfDepth + 1;
      const x = Math.round((site.x + Math.sin(site.rotationY) * reach) * 2) / 2;
      const z = Math.round((site.z + Math.cos(site.rotationY) * reach) * 2) / 2;
      expect(visited.has(key(x, z)), site.id).toBe(true);
    }
    for (const tent of festivalTentLayout) {
      const reach = tent.collider.size[1] / 2 + 1;
      const x = Math.round((tent.position[0] + Math.sin(tent.rotationY) * reach) * 2) / 2;
      const z = Math.round((tent.position[2] + Math.cos(tent.rotationY) * reach) * 2) / 2;
      expect(visited.has(key(x, z)), tent.id).toBe(true);
    }
  });

  it('bucketed grass mask matches the full footprint scan, including negative bucket edges', () => {
    for (let x = -56; x <= 56; x += 0.8) {
      for (let z = -56; z <= 56; z += 0.8) {
        let expected = 1;
        for (const t of allTentLayout) {
          const dx = x - t.position[0],
            dz = z - t.position[2],
            c = Math.cos(t.rotationY),
            s = Math.sin(t.rotationY);
          const d = Math.max(
            Math.abs(dx * c - dz * s) - t.collider.size[0] / 2 - 0.12,
            Math.abs(dx * s + dz * c) - t.collider.size[1] / 2 - 0.12,
          );
          const a = Math.max(0, Math.min(1, d / 0.2));
          expected = Math.min(expected, a * a * (3 - 2 * a));
        }
        expect(sampleTentGrassMask(x, z)).toBeCloseTo(expected, 9);
      }
    }
  });

  it('fits slopes conservatively and preserves authored offsets for legacy tents', () => {
    const config = {
      ...prototypeTentLayout[3],
      position: [0, 0, 0] as [number, number, number],
      terrainFit: true,
    };
    const slope = (x: number, z: number) => x * 0.03 + z * 0.025;
    expect(tentTerrainOffset(config, 0.046, slope)).toBeGreaterThan(0.09);
    expect(tentTerrainOffset({ ...config, terrainFit: false }, 0.046, slope)).toBe(0.04);
  });
});

describe('shared tent palettes', () => {
  it('clones only fabric materials and shares variants across both LODs and instances', () => {
    const cache = new TentPaletteCache();
    const fabric = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, map: new THREE.Texture() });
    fabric.userData.tentFabricRole = 'fly';
    const window = new THREE.MeshStandardMaterial();
    const source = new THREE.Group();
    source.add(
      new THREE.Mesh(new THREE.BoxGeometry(), fabric),
      new THREE.Mesh(new THREE.PlaneGeometry(), window),
    );
    const a = source.clone(true),
      b = source.clone(true),
      c = source.clone(true);
    const initial = fabric.color.clone();
    cache.apply(a, 'sage');
    cache.apply(b, 'sage');
    cache.apply(c, 'coral');
    const material = (g: THREE.Group) => (g.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
    expect(material(a)).toBe(material(b));
    expect(material(a)).not.toBe(material(c));
    expect(material(a).map).toBe(fabric.map);
    expect(material(a).color.getHexString()).toBe(CAMP_PALETTES.sage.fly.slice(1));
    expect(fabric.color.equals(initial)).toBe(true);
    expect((a.children[1] as THREE.Mesh).material).toBe(window);
    const disposal = vi.spyOn(material(a), 'dispose');
    const scene = new THREE.Group();
    scene.add(source, a, b, c);
    cache.clear();
    disposeObjectTree(scene);
    expect(disposal).toHaveBeenCalledTimes(1);
  });
});
