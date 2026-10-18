import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  placeFestivalProps,
  createScaledProp,
  FESTIVAL_PROP_PLACEMENTS,
  PROP_TARGET_HEIGHTS,
  type PropModelSources,
} from './festivalProps';
import { DEFAULT_FESTIVAL_CANS } from '../interactions/CanCollector';
import { WORLD_LIMIT } from './festivalLayout';

describe('festivalProps', () => {
  const dummyTerrainHeight = (x: number, z: number) => 0.05 * Math.sin(x + z);

  it('zawiera poprawne definicje placementów o docelowych wysokościach w granicach świata', () => {
    expect(FESTIVAL_PROP_PLACEMENTS.length).toBeGreaterThan(0);

    for (const p of FESTIVAL_PROP_PLACEMENTS) {
      expect(PROP_TARGET_HEIGHTS[p.type]).toBeGreaterThan(0);
      expect(Math.abs(p.position[0])).toBeLessThanOrEqual(WORLD_LIMIT);
      expect(Math.abs(p.position[2])).toBeLessThanOrEqual(WORLD_LIMIT);
    }
  });

  it('tworzy skalowany obiekt zastępczy przy braku modelu GLTF', () => {
    const targetH = 0.5;
    const prop = createScaledProp(null, targetH);
    expect(prop).toBeDefined();

    const box = new THREE.Box3().setFromObject(prop);
    const height = box.max.y - box.min.y;
    expect(height).toBeCloseTo(targetH, 2);
  });

  it('skaluje załadowany model GLTF do dokładnej wysokości docelowej', () => {
    const targetH = 0.98;
    // Mock GLTF o wymiarach 2x2x2
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
    const mockGLTF = {
      scene: new THREE.Group().add(mesh),
    } as any;

    const prop = createScaledProp(mockGLTF, targetH);
    const box = new THREE.Box3().setFromObject(prop);
    const height = box.max.y - box.min.y;
    expect(height).toBeCloseTo(targetH, 2);
    // Dolna podstawa modelu powinna spoczywać na y = 0
    expect(box.min.y).toBeCloseTo(0, 2);
  });

  it('rozmieszcza wszystkie rekwizyty scenografii oraz 10 puszek CanCollector', () => {
    const parent = new THREE.Group();
    const mockModels: PropModelSources = {
      beerCan: null,
      festivalChair: null,
      acousticGuitar: null,
      coolerBox: null,
      festivalBackpack: null,
    };

    const instance = placeFestivalProps(parent, mockModels, dummyTerrainHeight);

    expect(parent.children).toContain(instance.root);
    expect(instance.canMeshes.size).toBe(DEFAULT_FESTIVAL_CANS.length);
    expect(instance.allProps.size).toBe(FESTIVAL_PROP_PLACEMENTS.length + DEFAULT_FESTIVAL_CANS.length);

    // Sprawdzenie czy puszki można ukrywać i pokazywać
    const firstCan = DEFAULT_FESTIVAL_CANS[0];
    const canMesh = instance.canMeshes.get(firstCan.id);
    expect(canMesh).toBeDefined();
    expect(canMesh?.visible).toBe(true);

    instance.hideCan(firstCan.id);
    expect(canMesh?.visible).toBe(false);

    instance.showCan(firstCan.id);
    expect(canMesh?.visible).toBe(true);

    // Sprawdzenie sprzątania zasobów
    instance.dispose();
    expect(parent.children).not.toContain(instance.root);
    expect(instance.canMeshes.size).toBe(0);
    expect(instance.allProps.size).toBe(0);
  });
});
