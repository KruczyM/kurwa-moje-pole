import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { describe, expect, it, vi } from 'vitest';
import catalog from '../assets/assetCatalog.json';
import { environmentAssets } from '../assets/assetManifest';
import { disposeObjectTree } from '../lifecycle/disposeThree';
import { allTentLayout, tentColliderBounds } from './campLayout';
import { ROCK_SHOP_SITE } from './festivalLandmarks';
import {
  FESTIVAL_WHEEL_SITE,
  placeFestivalWheel,
  sampleWheelGrassMask,
  WHEEL_REVOLUTION_SECONDS,
} from './festivalWheel';
import { terrainHeight } from './terrainHeight';

const blob = () =>
  readFileSync(new URL(`../../../public/game-assets/${catalog.environment.allegroWheel}`, import.meta.url));
async function load() {
  const data = blob();
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'test-images', loadTexture: () => Promise.resolve(new THREE.Texture()) }));
  return loader.parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '');
}
const rotorOf = (root: THREE.Object3D) => root.getObjectByName('Wheel_Rotor')!;
const gondolasOf = (root: THREE.Object3D) =>
  rotorOf(root).children.filter((o) => o.userData.wheelPart === 'gondola');

describe('festival wheel model and animation', () => {
  it('ships a bounded, shared-geometry model with steady emissive lights and no hidden animations', async () => {
    expect(environmentAssets.allegroWheel).toContain('game-assets/world/festival/allegroWheel.glb');
    expect(blob().length).toBeLessThan(1_300_000);
    const source = await load();
    try {
      expect(source.animations).toHaveLength(0);
      const meta = source.scene.getObjectByName('Allegro_Wheel_Prototype')!.userData;
      expect(meta.referenceStatus).toContain('estimated');
      expect(meta.wheelGondolaCount).toBe(24);
      const size = new THREE.Box3().setFromObject(source.scene).getSize(new THREE.Vector3());
      expect(size.x).toBeCloseTo(31.7, 2);
      expect(size.y).toBeGreaterThan(33);
      expect(size.y).toBeLessThan(33.1);
      expect(size.z).toBeLessThan(10.4);
      const cabins = gondolasOf(source.scene);
      expect(cabins).toHaveLength(24);
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      for (const cabin of cabins) {
        expect(cabin.parent).toBe(rotorOf(source.scene));
        expect(cabin.position.length()).toBeCloseTo(15, 4);
        cabin.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            geometries.add(obj.geometry);
            materials.add(obj.material as THREE.Material);
          }
        });
      }
      expect(geometries.size).toBe(2);
      expect(materials.size).toBe(2);
      let triangles = 0,
        meshes = 0;
      const emissive = new Set<THREE.Material>();
      source.scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        meshes++;
        triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
        const mat = object.material as THREE.MeshStandardMaterial;
        if (mat.name === 'Wheel_Orange' || mat.name === 'Wheel_Painted_Steel') {
          expect(mat.map).toBeTruthy();
          expect(mat.roughnessMap).toBeTruthy();
          expect(
            object.geometry.getAttribute(mat.map!.channel ? `uv${mat.map!.channel}` : 'uv'),
          ).toBeTruthy();
        }
        if (mat.emissive.getHex() !== 0) {
          emissive.add(mat);
          expect(mat.emissiveIntensity).toBeGreaterThan(1);
        }
      });
      expect(emissive.size).toBe(6);
      expect(meshes).toBeLessThanOrEqual(61);
      expect(triangles).toBeLessThan(33000);
    } finally {
      disposeObjectTree(source.scene);
    }
  });

  it('turns about the hub while cabins stay upright at every sampled angle, without moving cached transforms', async () => {
    const source = await load();
    const parent = new THREE.Group();
    const sourceRotor = rotorOf(source.scene);
    const originalRotation = sourceRotor.quaternion.clone();
    const wheel = placeFestivalWheel(parent, source, terrainHeight)!;
    try {
      const rotor = rotorOf(wheel.root);
      const pivot = rotor.getWorldPosition(new THREE.Vector3());
      const cabin = gondolasOf(wheel.root)[0];
      const start = cabin.getWorldPosition(new THREE.Vector3());
      expect(start.y - pivot.y).toBeCloseTo(15, 5);
      wheel.update(WHEEL_REVOLUTION_SECONDS / 4);
      parent.updateMatrixWorld(true);
      const quarter = cabin.getWorldPosition(new THREE.Vector3());
      expect(quarter.x - pivot.x).toBeCloseTo(-15, 5);
      expect(quarter.y).toBeCloseTo(pivot.y, 5);
      for (let step = 0; step < 48; step++) {
        wheel.update(WHEEL_REVOLUTION_SECONDS / 48);
        parent.updateMatrixWorld(true);
        for (const gondola of gondolasOf(wheel.root)) {
          const q = gondola.getWorldQuaternion(new THREE.Quaternion());
          const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
          expect(up.distanceTo(new THREE.Vector3(0, 1, 0))).toBeLessThan(0.00001);
          const position = gondola.getWorldPosition(new THREE.Vector3());
          expect(position.distanceTo(pivot)).toBeCloseTo(15, 4);
          expect(new THREE.Box3().setFromObject(gondola).min.y).toBeGreaterThan(wheel.root.position.y + 0.6);
        }
      }
      expect(sourceRotor.quaternion.equals(originalRotation)).toBe(true);
      expect(sourceRotor.position.toArray()).toEqual([0, 18, 0]);
    } finally {
      wheel.dispose();
      parent.add(source.scene);
      disposeObjectTree(parent);
    }
  });

  it('is frame-rate independent, freezes for reduced motion and ignores invalid time or updates after disposal', async () => {
    const source = await load();
    const parent = new THREE.Group();
    const a = placeFestivalWheel(parent, source, terrainHeight)!;
    const b = placeFestivalWheel(parent, source, terrainHeight)!;
    try {
      for (let i = 0; i < 300; i++) a.update(1 / 30);
      for (let i = 0; i < 1440; i++) b.update(1 / 144);
      expect(rotorOf(a.root).quaternion.angleTo(rotorOf(b.root).quaternion)).toBeLessThan(0.000001);
      const before = rotorOf(a.root).quaternion.clone();
      a.update(10, true);
      for (const dt of [0, -1, NaN, Infinity]) a.update(dt);
      expect(rotorOf(a.root).quaternion.equals(before)).toBe(true);
      a.dispose();
      a.dispose();
      a.update(10);
      expect(rotorOf(a.root).quaternion.equals(before)).toBe(true);
      const mesh = gondolasOf(b.root)[0].children.find((o) => o instanceof THREE.Mesh) as THREE.Mesh;
      const spy = vi.spyOn(mesh.geometry, 'dispose');
      parent.add(source.scene);
      disposeObjectTree(parent);
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      a.dispose();
      b.dispose();
      parent.clear();
    }
  });

  it('keeps its footprint outside tents/shop, suppresses deck grass and never adds a missing-model collider', async () => {
    const source = await load();
    const parent = new THREE.Group();
    const wheel = placeFestivalWheel(parent, source, terrainHeight)!;
    try {
      const c = wheel.collider;
      for (const t of allTentLayout) {
        const b = tentColliderBounds(t);
        expect(c.max.x > b.minX && c.min.x < b.maxX && c.max.z > b.minZ && c.min.z < b.maxZ, t.id).toBe(
          false,
        );
      }
      expect(c.min.x).toBeGreaterThan(ROCK_SHOP_SITE.x + ROCK_SHOP_SITE.halfWidth);
      const deck = new THREE.Box3().setFromObject(wheel.root.getObjectByName('Static_Wheel_Deck')!);
      for (let x = deck.min.x; x <= deck.max.x; x += 0.25) {
        for (let z = deck.min.z; z <= deck.max.z; z += 0.25) {
          expect(deck.min.y - terrainHeight(x, z)).toBeGreaterThan(0.025);
          expect(sampleWheelGrassMask(x, z)).toBe(0);
        }
      }
      const s = FESTIVAL_WHEEL_SITE;
      expect(sampleWheelGrassMask(s.x + 9.35, s.z)).toBeCloseTo(0.5);
      expect(sampleWheelGrassMask(s.x + 10, s.z)).toBe(1);
      expect(placeFestivalWheel(parent, null, terrainHeight)).toBeNull();
      expect(parent.children).toHaveLength(1);
    } finally {
      wheel.dispose();
      parent.add(source.scene);
      disposeObjectTree(parent);
    }
  });
});
