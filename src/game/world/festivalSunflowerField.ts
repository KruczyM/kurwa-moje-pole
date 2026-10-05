import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Authentic Pol'and'Rock Festival Sunflower Field (Pole Słoneczników)
 * Situated along the southern concrete avenue near Duża Scena entrance:
 * x: 44..108, z: 80..106
 */
export const SUNFLOWER_FIELD_BOUNDS = {
  minX: 44,
  maxX: 108,
  minZ: 80,
  maxZ: 106,
} as const;

export class SunflowerFieldInstance {
  public root = new THREE.Group();
  public instancedMeshes: THREE.InstancedMesh[] = [];
  public soilMesh: THREE.Mesh | null = null;

  public dispose(): void {
    for (const im of this.instancedMeshes) {
      im.geometry.dispose();
      if (Array.isArray(im.material)) {
        im.material.forEach((m) => m.dispose());
      } else {
        im.material.dispose();
      }
    }
    this.instancedMeshes.length = 0;

    if (this.soilMesh) {
      this.soilMesh.geometry.dispose();
      if (Array.isArray(this.soilMesh.material)) {
        this.soilMesh.material.forEach((m) => m.dispose());
      } else {
        this.soilMesh.material.dispose();
      }
      this.soilMesh = null;
    }

    if (this.root.parent) {
      this.root.parent.remove(this.root);
    }
  }
}

export function sampleSunflowerFieldGrassMask(x: number, z: number): number {
  const b = SUNFLOWER_FIELD_BOUNDS;
  const distance = Math.max(b.minX - x, x - b.maxX, b.minZ - z, z - b.maxZ);
  // Suppress tall wild meadow grass inside the cultivated sunflower plantation
  return THREE.MathUtils.smoothstep(distance, -0.8, 1.2);
}

/**
 * Procedural pseudo-random deterministic generator using fixed seed
 */
function createDeterministicRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function placeSunflowerField(
  parent: THREE.Object3D,
  model: GLTF | null | undefined,
  heightAt: (x: number, z: number) => number,
  soilTexture?: THREE.Texture | null,
): SunflowerFieldInstance {
  const instance = new SunflowerFieldInstance();
  instance.root.name = 'Festival_Sunflower_Field';
  parent.add(instance.root);

  const b = SUNFLOWER_FIELD_BOUNDS;
  const fieldWidth = b.maxX - b.minX;
  const fieldDepth = b.maxZ - b.minZ;

  // 1. Cultivated Dark Earth Bed Mesh
  const segX = Math.round(fieldWidth / 2);
  const segZ = Math.round(fieldDepth / 2);
  const soilGeo = new THREE.PlaneGeometry(fieldWidth + 2.0, fieldDepth + 2.0, segX, segZ).rotateX(
    -Math.PI / 2,
  );
  const posAttr = soilGeo.attributes.position;
  const centerX = (b.minX + b.maxX) / 2;
  const centerZ = (b.minZ + b.maxZ) / 2;

  for (let i = 0; i < posAttr.count; i++) {
    const vx = centerX + posAttr.getX(i);
    const vz = centerZ + posAttr.getZ(i);
    const ground = heightAt(vx, vz);
    posAttr.setY(i, ground + 0.035);
  }
  soilGeo.computeVertexNormals();

  const soilMat = new THREE.MeshStandardMaterial({
    color: 0x483624,
    roughness: 0.94,
    metalness: 0.0,
    map: soilTexture ?? null,
  });
  if (soilTexture) {
    soilTexture.wrapS = THREE.RepeatWrapping;
    soilTexture.wrapT = THREE.RepeatWrapping;
    soilTexture.repeat.set(fieldWidth / 4.0, fieldDepth / 4.0);
  }

  const soilMesh = new THREE.Mesh(soilGeo, soilMat);
  soilMesh.name = 'Sunflower_Field_Soil';
  soilMesh.position.set(centerX, 0, centerZ);
  soilMesh.receiveShadow = true;
  instance.root.add(soilMesh);
  instance.soilMesh = soilMesh;

  if (!model) return instance;

  // 2. Extract Submeshes from sunflower model
  type MeshTemplate = {
    geometry: THREE.BufferGeometry;
    material: THREE.Material;
  };
  const templates: MeshTemplate[] = [];

  model.scene.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const mat = (child.material as THREE.Material).clone();
      if ('side' in mat) {
        (mat as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
      }
      if ('alphaTest' in mat) {
        (mat as THREE.MeshStandardMaterial).alphaTest = 0.5;
        (mat as THREE.MeshStandardMaterial).depthWrite = true;
      }
      templates.push({
        geometry: child.geometry.clone(),
        material: mat,
      });
    }
  });

  if (templates.length === 0) return instance;

  // 3. Grid coordinates with organic jitter
  const stepX = 1.05;
  const stepZ = 1.05;
  const positions: Array<{
    x: number;
    y: number;
    z: number;
    scaleX: number;
    scaleY: number;
    scaleZ: number;
    rotY: number;
    rotX: number;
  }> = [];

  const rand = createDeterministicRandom(20260801);

  for (let x = b.minX + 1.2; x <= b.maxX - 1.2; x += stepX) {
    for (let z = b.minZ + 1.2; z <= b.maxZ - 1.2; z += stepZ) {
      const jitterX = (rand() - 0.5) * 0.42;
      const jitterZ = (rand() - 0.5) * 0.42;
      const px = x + jitterX;
      const pz = z + jitterZ;
      const py = heightAt(px, pz);

      const scaleY = 0.85 + rand() * 0.35; // 1.55m to 2.20m tall
      const scaleXZ = 0.88 + rand() * 0.24;
      // Facing north towards the road (-Z), with natural +/- 20 deg yaw sway
      const rotY = (rand() - 0.5) * 0.7;
      const rotX = (rand() - 0.5) * 0.12;

      positions.push({
        x: px,
        y: py,
        z: pz,
        scaleX: scaleXZ,
        scaleY,
        scaleZ: scaleXZ,
        rotY,
        rotX,
      });
    }
  }

  const count = positions.length;
  const dummy = new THREE.Object3D();

  for (const tpl of templates) {
    const instMesh = new THREE.InstancedMesh(tpl.geometry, tpl.material, count);
    instMesh.name = `Sunflower_Instanced_${templates.indexOf(tpl)}`;
    instMesh.castShadow = true;
    instMesh.receiveShadow = true;

    for (let i = 0; i < count; i++) {
      const p = positions[i];
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.rotX, p.rotY, 0);
      dummy.scale.set(p.scaleX, p.scaleY, p.scaleZ);
      dummy.updateMatrix();

      instMesh.setMatrixAt(i, dummy.matrix);
    }

    instMesh.instanceMatrix.needsUpdate = true;
    instance.root.add(instMesh);
    instance.instancedMeshes.push(instMesh);
  }

  return instance;
}
