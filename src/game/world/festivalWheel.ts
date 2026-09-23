import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

/** Staging location only; estimated geometry, not the surveyed festival layout. */
export const FESTIVAL_WHEEL_SITE = { x: 37, z: 0, halfWidth: 16.2, halfDepth: 5.5 } as const;
export const WHEEL_REVOLUTION_SECONDS = 120;
const AXIS = new THREE.Vector3(0, 0, 1);

export function sampleWheelGrassMask(x: number, z: number) {
  const distance = Math.max(
    Math.abs(x - FESTIVAL_WHEEL_SITE.x) - 9.2,
    Math.abs(z - FESTIVAL_WHEEL_SITE.z) - 5.5,
  );
  return THREE.MathUtils.smoothstep(distance, 0, 0.3);
}

/** Only transforms an existing cached model; scene lifecycle owns its GPU resources. */
export class FestivalWheel {
  private angle = 0;
  private disposed = false;
  private rotation = new THREE.Quaternion();
  private readonly baseRotation: THREE.Quaternion;
  private readonly gondolas: { object: THREE.Object3D; baseRotation: THREE.Quaternion }[];

  constructor(
    readonly root: THREE.Object3D,
    readonly collider: THREE.Box3,
    private readonly rotor: THREE.Object3D,
    gondolas: THREE.Object3D[],
  ) {
    this.baseRotation = rotor.quaternion.clone();
    this.gondolas = gondolas.map((object) => ({ object, baseRotation: object.quaternion.clone() }));
  }

  update(deltaSeconds: number, reduceMotion = false) {
    if (this.disposed || reduceMotion || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;
    this.angle = (this.angle + (deltaSeconds / WHEEL_REVOLUTION_SECONDS) * Math.PI * 2) % (Math.PI * 2);
    this.rotation.setFromAxisAngle(AXIS, this.angle);
    this.rotor.quaternion.copy(this.baseRotation).multiply(this.rotation);
    this.rotation.invert();
    for (const gondola of this.gondolas) {
      gondola.object.quaternion.copy(this.rotation).multiply(gondola.baseRotation);
    }
  }

  /** Stop updates; shared meshes are released once by the existing scene disposer. */
  dispose() {
    this.disposed = true;
    this.gondolas.length = 0;
  }
}

export function placeFestivalWheel(
  parent: THREE.Object3D,
  source: GLTF | null | undefined,
  heightAt: (x: number, z: number) => number,
): FestivalWheel | null {
  if (!source) return null;
  const root = clone(source.scene);
  let rotor: THREE.Object3D | undefined;
  root.traverse((object) => {
    if (object.userData.wheelPart === 'rotor') rotor = object;
  });
  if (!rotor) return null;
  const gondolas = rotor.children.filter((object) => object.userData.wheelPart === 'gondola');
  if (gondolas.length !== 24) return null;
  const site = FESTIVAL_WHEEL_SITE;
  let ground = -Infinity;
  for (let x = -9.2; x <= 9.45; x += 0.25) {
    for (let z = -5.5; z <= 5.75; z += 0.25) {
      ground = Math.max(ground, heightAt(site.x + x, site.z + z));
    }
  }
  root.name = 'Festival_Allegro_Wheel';
  root.position.set(site.x, ground + 0.025, site.z);
  root.userData.exteriorOnly = true;
  root.userData.campObject = { id: 'allegroWheel', label: 'Młyn Allegro — prototyp' };
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  parent.add(root);
  root.updateMatrixWorld(true);
  const collider = new THREE.Box3(
    new THREE.Vector3(site.x - site.halfWidth, -2, site.z - site.halfDepth),
    new THREE.Vector3(site.x + site.halfWidth, ground + 34, site.z + site.halfDepth),
  );
  return new FestivalWheel(root, collider, rotor, gondolas);
}
