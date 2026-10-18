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
import { WORLD_LIMIT } from './festivalLayout';
import { FESTIVAL_STAGE_SITES, stageBounds } from './festivalStages';

const overlap = (a: ReturnType<typeof tentColliderBounds>, b: ReturnType<typeof tentColliderBounds>) =>
  a.maxX > b.minX && a.minX < b.maxX && a.maxZ > b.minZ && a.minZ < b.maxZ;

describe('festival camping staging sectors', () => {
  it('keeps intersections bare even inside the feathered edge of another lane', () => {
    const sector = FESTIVAL_CAMP_SECTORS[0];
    expect(sampleFestivalRoadMask(sector.minX - 1, sector.minZ + 9)).toBe(0);
    expect(sampleFestivalRoadMask(sector.minX + 0.1, sector.minZ + 4.5)).toBeCloseTo(0.4);
    expect(sampleFestivalRoadMask(sector.minX + 18, sector.minZ + 18)).toBe(1);
  });
  it('creates a deterministic, varied layout without mutating templates', () => {
    const before = JSON.stringify(prototypeTentLayout);
    const first = createFestivalCamp(prototypeTentLayout, [], 2026);
    expect(first).toEqual(createFestivalCamp(prototypeTentLayout, [], 2026));
    expect(first).not.toEqual(createFestivalCamp(prototypeTentLayout, [], 2027));
    expect(first).toHaveLength(FESTIVAL_CAMP_SECTORS.length * 16);
    expect(festivalTentLayout).toHaveLength(FESTIVAL_CAMP_SECTORS.length * 16 - 4);
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
  }, 30000);

  it('every entrance approach can be reached from the original camp on a 0.5 m grid', () => {
    const boxes = allTentLayout.map(tentColliderBounds);
    boxes.push(...MARKET_STALL_LAYOUT.map(marketColliderBounds));
    boxes.push(...FESTIVAL_ZONE_SITES.map(zoneBounds));
    boxes.push(...FESTIVAL_STAGE_SITES.map(stageBounds));
    for (const site of [ROCK_SHOP_SITE, FESTIVAL_WHEEL_SITE]) {
      boxes.push({
        minX: site.x - site.halfWidth,
        maxX: site.x + site.halfWidth,
        minZ: site.z - site.halfDepth,
        maxZ: site.z + site.halfDepth,
      });
    }
    const limit = WORLD_LIMIT - 2,
      step = 0.5,
      width = limit * 4 + 1;
    const visited = new Uint8Array(width * width);
    const key = (x: number, z: number) =>
      Math.round((z + limit) / step) * width + Math.round((x + limit) / step);
    for (const b of boxes) {
      for (
        let r = Math.ceil((b.minZ - 0.45 + limit) / step);
        r <= Math.floor((b.maxZ + 0.45 + limit) / step);
        r++
      )
        for (
          let c = Math.ceil((b.minX - 0.45 + limit) / step);
          c <= Math.floor((b.maxX + 0.45 + limit) / step);
          c++
        )
          visited[r * width + c] = 2;
    }
    const queue = new Int32Array(width * width);
    queue[0] = key(0, 0);
    visited[queue[0]] = 1;
    let tail = 1;
    for (let head = 0; head < tail; head++) {
      const id = queue[head],
        column = id % width;
      for (const next of [
        column > 0 ? id - 1 : -1,
        column < width - 1 ? id + 1 : -1,
        id - width,
        id + width,
      ]) {
        if (next < 0 || next >= visited.length || visited[next]) continue;
        visited[next] = 1;
        queue[tail++] = next;
      }
    }
    for (const stall of MARKET_STALL_LAYOUT) {
      expect(visited[key(stall.x, stall.z + (stall.variant === 'siemaShop' ? 10 : 4))] === 1, stall.id).toBe(
        true,
      );
    }
    for (const site of FESTIVAL_ZONE_SITES) {
      const reach = site.id === 'redBull' ? site.halfWidth + 1 : site.halfDepth + 1;
      const x = Math.round((site.x + Math.sin(site.rotationY) * reach) * 2) / 2;
      const z = Math.round((site.z + Math.cos(site.rotationY) * reach) * 2) / 2;
      expect(visited[key(x, z)], site.id).toBe(1);
    }
    for (const tent of festivalTentLayout) {
      const reach = tent.collider.size[1] / 2 + 1;
      const x = Math.round((tent.position[0] + Math.sin(tent.rotationY) * reach) * 2) / 2;
      const z = Math.round((tent.position[2] + Math.cos(tent.rotationY) * reach) * 2) / 2;
      expect(visited[key(x, z)], tent.id).toBe(1);
    }
  });

  it('bucketed grass mask matches the full footprint scan, including negative bucket edges', () => {
    for (let x = -WORLD_LIMIT; x <= WORLD_LIMIT; x += 3.1) {
      for (let z = -WORLD_LIMIT; z <= WORLD_LIMIT; z += 3.1) {
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
