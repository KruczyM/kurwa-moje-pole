import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { describe, expect, it, vi } from 'vitest';
import { InteractionManager } from '../interactions/InteractionManager';
import { disposeObjectTree } from '../lifecycle/disposeThree';
import {
  CampWorld,
  formatTentDimensions,
  interactionDebugEnabled,
  physicalScale,
  physicalSizeIsValid,
  terrainHeight,
  TOILET_HEIGHT_METERS,
} from './CampWorld';
import { WORLD_SIZE } from './festivalLayout';
import { campPosition } from './campLayout';

describe('CampWorld terrain placement', () => {
  it('shows shared dynamic meshes only in their place without enabling scaffold proxies or disabling interaction layers', () => {
    const world = Object.create(CampWorld.prototype) as CampWorld;
    const authoredRoot = new THREE.Group();
    const camp = new THREE.Mesh(new THREE.BoxGeometry());
    camp.layers.enable(2);
    const wheel = new THREE.Mesh(new THREE.BoxGeometry());
    wheel.position.set(116, 0, -59);
    const stage = new THREE.Mesh(new THREE.BoxGeometry());
    stage.position.set(223, 0, 21);
    const proxy = new THREE.Mesh(new THREE.BoxGeometry());
    proxy.userData.fogProxy = true;
    proxy.layers.disable(0);
    authoredRoot.add(camp, wheel, stage, proxy);
    Object.assign(world, { authoredRoot, landmarksRoot: new THREE.Group() });
    world.setMobileArea('camp');
    expect(camp.layers.isEnabled(0)).toBe(true);
    expect(wheel.layers.isEnabled(0)).toBe(false);
    world.setMobileArea('wheel');
    expect(wheel.layers.isEnabled(0)).toBe(true);
    expect(camp.layers.isEnabled(0)).toBe(false);
    expect(camp.layers.isEnabled(2)).toBe(true);
    world.setMobileArea('main-stage');
    expect(stage.layers.isEnabled(0)).toBe(true);
    expect(proxy.layers.isEnabled(0)).toBe(false);
    world.setMobileArea();
    expect(stage.layers.isEnabled(0)).toBe(false);
  });
  it('places wcTron on the same procedural surface that is rendered below it', () => {
    const [x, , z] = campPosition(8, 18);
    const height = terrainHeight(x, z);

    expect(Number.isFinite(height)).toBe(true);
    expect(height).toBeGreaterThan(-0.3);
    expect(height).toBeLessThan(0.3);
  });

  it('keeps wcTron at least twice as tall as a nominal 1.8 m character', () => {
    expect(TOILET_HEIGHT_METERS).toBeGreaterThanOrEqual(1.8 * 2);
  });

  it('enables interaction hitboxes only through an explicit URL flag', () => {
    expect(interactionDebugEnabled('?debugInteractions=1')).toBe(true);
    expect(interactionDebugEnabled('?debugInteractions=0')).toBe(false);
    expect(interactionDebugEnabled('')).toBe(false);
  });

  it('uses uniform scale for correctly proportioned tents', () => {
    const scale = physicalScale(new THREE.Vector3(2, 1, 2), [2.5, 1.25, 2.5], 'uniform-height');
    expect(scale.toArray()).toEqual([1.25, 1.25, 1.25]);
  });

  it('corrects each axis only for a source model with incorrect proportions', () => {
    const scale = physicalScale(new THREE.Vector3(4, 3, 5), [3.65, 2.1, 5.6], 'exact-source-correction');
    expect(new THREE.Vector3(4, 3, 5).multiply(scale).toArray()).toEqual([3.65, 2.1, 5.6]);
    expect(formatTentDimensions('T01', new THREE.Vector3(3.65, 2.1, 5.6))).toBe(
      'T01: 3.65m × 5.60m, wysokość 2.10m',
    );
    expect(
      physicalSizeIsValid(new THREE.Vector3(3.65, 2.1, 5.6), [3.65, 2.1, 5.6], 'exact-source-correction'),
    ).toBe(true);
    expect(physicalSizeIsValid(new THREE.Vector3(30, 1.25, 30), [2, 1.25, 2], 'uniform-height')).toBe(true);
  });

  it('tworzy materiał PBR ziemi z powtarzaniem i prawidłowymi przestrzeniami barw', async () => {
    const { createGroundMaterial } = await import('./CampWorld');
    const colorTex = new THREE.Texture();
    const normalTex = new THREE.Texture();
    const roughnessTex = new THREE.Texture();

    const mat = createGroundMaterial({
      grassColor: colorTex,
      grassNormal: normalTex,
      grassRoughness: roughnessTex,
    });

    expect(mat).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(mat.map).toBe(colorTex);
    expect(mat.normalMap).toBe(normalTex);
    expect(mat.roughnessMap).toBe(roughnessTex);
    expect(colorTex.wrapS).toBe(THREE.RepeatWrapping);
    expect(colorTex.wrapT).toBe(THREE.RepeatWrapping);
    expect(colorTex.repeat.x).toBeCloseTo(WORLD_SIZE / 1.4);
    expect(mat.color.getHex()).toBe(0xffffff);
    expect(colorTex.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(normalTex.colorSpace).toBe(THREE.NoColorSpace);
  });

  it('gwarantuje łagodne nachylenie fal terenu bez ostrych uskoków i skarp', () => {
    // Sprawdzamy próbkowanie siatki co 1m w promieniu obozu [-40, 40]
    for (let x = -40; x <= 40; x += 4) {
      for (let z = -40; z <= 40; z += 4) {
        const h = terrainHeight(x, z);
        const hDx = terrainHeight(x + 1, z);
        const hDz = terrainHeight(x, z + 1);

        const slopeX = Math.abs(hDx - h);
        const slopeZ = Math.abs(hDz - h);

        // Maksymalne nachylenie na 1 metr nie powinno przekraczać 10 cm (0.1m)
        expect(slopeX).toBeLessThan(0.1);
        expect(slopeZ).toBeLessThan(0.1);
      }
    }
  });
});

describe('camp table and contraband stall', () => {
  it('places the speaker mount on the camp table and makes each drug collectible from the passage', () => {
    const scene = new THREE.Scene();
    const authored = new THREE.Group();
    const camp = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    camp.userData.runtimePlacement = 'MadDog';
    camp.position.set(2, 0, 3);
    authored.add(camp);
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => null }) });
    try {
      const world = new CampWorld(scene, {
        authoredFestival: { scene: authored } as GLTF,
        beerCan: null,
        fogTrial: true,
        interactables: new Map(),
      });
      const table = scene.getObjectByName('CampTable')!;
      expect(world.speakerMount?.parent?.parent).toBe(table);
      expect(world.speakerMount?.getWorldPosition(new THREE.Vector3()).y).toBeCloseTo(1.12);
      const stall = scene.getObjectByName('ContrabandStall')!;
      const items = world.interactables.filter((entry) => entry.action === 'item');
      const market = items.filter((item) => item.object.parent?.parent === stall);
      expect(market.map((item) => item.itemId)).toEqual(['joint', 'cocaine', 'mdma', 'mushrooms', 'lsd']);
      expect(items.filter((item) => item.object.parent?.parent === table).map((item) => item.itemId)).toEqual(
        ['cigarette', 'water', 'sunglasses'],
      );
      expect(world.canMove(stall.position.x, stall.position.z + 1.25)).toBe(true);
      expect(world.canMove(stall.position.x, stall.position.z + 0.15)).toBe(false);

      const camera = new THREE.PerspectiveCamera();
      const manager = new InteractionManager(camera, () => world.interactables.map((item) => item.object));
      scene.updateMatrixWorld(true);
      for (const item of market) {
        const point = item.object.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.08, 0));
        camera.position.set(point.x, 1.9, stall.position.z - 2);
        camera.lookAt(point);
        camera.updateMatrixWorld(true);
        expect(manager.update()).toBeNull();
        camera.position.z = stall.position.z + 1.25;
        camera.lookAt(point);
        camera.updateMatrixWorld(true);
        expect(manager.update()).toMatchObject({ kind: 'item', itemId: item.itemId });
        expect(world.removeItem(item.itemId)).toBe(true);
        expect(item.object.parent).toBeNull();
        expect(manager.update()).toBeNull();
      }
      manager.dispose();
      world.dispose();
    } finally {
      vi.unstubAllGlobals();
      disposeObjectTree(scene);
    }
  });
});
