import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Grass } from './vendor/three-stylized/Grass';
import { sampleCampGrassCoverage } from './campLayout';
import { terrainHeight } from './CampWorld';

function createCampTerrainMesh(): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(117.6, 117.6, 96, 96).rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index);
    const z = positions.getZ(index);
    positions.setY(index, terrainHeight(x, z));
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
}

describe('Ghibli Grass Generation & Performance', () => {
  it('instantiates CampWorld grass in under 1.5 seconds and produces blades', () => {
    const ground = createCampTerrainMesh();
    const t0 = performance.now();

    const grass = new Grass({
      surface: ground,
      grass: {
        density: 16,
        brightness: 0.42,
        coverage: {
          sample: (point) => sampleCampGrassCoverage(point.position.x, point.position.z),
        },
        blade: { minHeight: 0.18, maxHeight: 0.58, minWidth: 0.025, maxWidth: 0.085, segments: 4 },
        colors: { bottom: '#4a6325', top: '#a8b548', backlight: '#d8e572', ground: '#4a6325' },
        wind: { strength: 0.16, speed: 0.85, frequency: 0.55, turbulence: 0.22, lean: 0.025, direction: 32 },
        lighting: { direction: new THREE.Vector3(-10, 17, 8).normalize(), color: '#ffe0b0', intensity: 1.1 },
        shadow: false,
      },
      wildflowers: { enabled: false },
    });

    const elapsedMs = performance.now() - t0;
    console.log(`Grass generated in ${elapsedMs.toFixed(1)} ms with ${grass.bladeCount} blades.`);

    expect(elapsedMs).toBeLessThan(1500);
    expect(grass.bladeCount).toBeGreaterThan(1000);

    expect(grass.blades).toBeDefined();
    expect(grass.blades.isGroup).toBe(true);
    expect(grass.blades.children.length).toBeGreaterThan(0);

    const instancedMesh = grass.blades.blades;
    expect(instancedMesh).toBeDefined();
    expect(instancedMesh.isInstancedMesh).toBe(true);
    expect(instancedMesh.count).toBe(grass.bladeCount);

    const matrix = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    let bladesInsideSectors = 0;
    let bladesOnFireRoadCenter = 0;

    for (let i = 0; i < instancedMesh.count; i++) {
      instancedMesh.getMatrixAt(i, matrix);
      pos.setFromMatrixPosition(matrix);

      if (Math.abs(pos.x) < 0.3 && Math.abs(pos.z) < 14) {
        bladesOnFireRoadCenter++;
      }

      const coverage = sampleCampGrassCoverage(pos.x, pos.z);
      if (coverage > 0.3) {
        bladesInsideSectors++;
      }
    }

    expect(bladesOnFireRoadCenter).toBeLessThanOrEqual(5);
    expect(bladesInsideSectors).toBeGreaterThan(grass.bladeCount * 0.9);

    expect(grass.tutorialGrass).toBeDefined();
    expect(grass.tutorialGrass.isMesh).toBe(true);
    expect(grass.distantGrass).toBeDefined();
    expect(grass.distantGrass.isMesh).toBe(true);

    grass.dispose();
  });
});
