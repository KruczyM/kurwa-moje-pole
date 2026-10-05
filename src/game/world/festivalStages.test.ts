import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';
import catalog from '../assets/assetCatalog.json';
import {
  createStageGrassMask,
  FESTIVAL_STAGE_SITES,
  placeFestivalStages,
  stageBounds,
  type StageModels,
} from './festivalStages';
import { allTentLayout, tentColliderBounds } from './campLayout';
import { MARKET_LANE, MARKET_STALL_LAYOUT, marketColliderBounds } from './festivalMarket';
import { FESTIVAL_ZONE_SITES, zoneBounds } from './festivalZones';
import { disposeObjectTree } from '../lifecycle/disposeThree';

describe('provisional generated stages', () => {
  it('loads both real GLBs, grounds and uniformly scales them inside reserved colliders', async () => {
    const models: StageModels = {};
    const loader = new GLTFLoader();
    loader.register(() => ({ name: 'test-images', loadTexture: () => Promise.resolve(new THREE.Texture()) }));
    const parent = new THREE.Group();
    try {
      for (const site of FESTIVAL_STAGE_SITES) {
        const bytes = readFileSync(
          new URL(`../../../public/game-assets/${catalog.environment[site.id]}`, import.meta.url),
        );
        models[site.id] = await loader.parseAsync(
          bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
          '',
        );
      }
      const originals = FESTIVAL_STAGE_SITES.map((s) => models[s.id]!.scene.matrix.clone());
      const boxes = placeFestivalStages(parent, models, () => 0);
      expect(parent.children).toHaveLength(2);
      expect(boxes.length).toBeGreaterThanOrEqual(2);
      const mainRoot = parent.children[0];
      const mainBounds = new THREE.Box3().setFromObject(mainRoot);
      expect(mainBounds.min.y).toBeCloseTo(0.025);
      expect(boxes[0].clone().expandByScalar(0.001).containsBox(mainBounds)).toBe(true);
      const aspRoot = parent.children[1];
      const aspBounds = new THREE.Box3().setFromObject(aspRoot);
      expect(aspBounds.min.y).toBeCloseTo(0.025);
      const entrancePoint = new THREE.Vector3(
        aspBounds.min.x + 0.5,
        1.0,
        (aspBounds.min.z + aspBounds.max.z) / 2,
      );
      expect(boxes.some((b) => b.containsPoint(entrancePoint))).toBe(false);
      for (let i = 0; i < 2; i++) {
        const root = parent.children[i];
        expect(root.children[0].scale.x).toBeCloseTo(root.children[0].scale.y);
        expect(root.children[0].scale.y).toBeCloseTo(root.children[0].scale.z);
        expect(models[FESTIVAL_STAGE_SITES[i].id]!.scene.matrix.equals(originals[i])).toBe(true);
      }
      const mask = createStageGrassMask(models);
      for (const site of FESTIVAL_STAGE_SITES) expect(mask(site.x, site.z)).toBe(0);
      expect(mask(0, 0)).toBe(1);
      expect(placeFestivalStages(new THREE.Group(), {}, () => 0)).toHaveLength(0);
      expect(createStageGrassMask({})(216, 18)).toBe(1);
    } finally {
      for (const model of Object.values(models)) if (model) parent.add(model.scene);
      disposeObjectTree(parent);
    }
  });

  it('leaves camp plots, shops and the asphalt passage clear', () => {
    const occupied = [
      ...allTentLayout.map(tentColliderBounds),
      ...MARKET_STALL_LAYOUT.map(marketColliderBounds),
      ...FESTIVAL_ZONE_SITES.map(zoneBounds),
      MARKET_LANE,
    ];
    for (const site of FESTIVAL_STAGE_SITES) {
      const box = stageBounds(site);
      for (const other of occupied)
        expect(
          box.maxX > other.minX && box.minX < other.maxX && box.maxZ > other.minZ && box.minZ < other.maxZ,
        ).toBe(false);
    }
  });
});
