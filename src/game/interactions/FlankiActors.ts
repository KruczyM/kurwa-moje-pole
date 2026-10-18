import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { NpcAnimator } from '../npc/NpcAnimator';
import { NPC_BODY_WIDTH_SCALE, NPC_BODY_DEPTH_SCALE } from '../npc/modelProportions';

/** Shares cached meshes/textures but owns its skeleton and mixer. No primitive NPC fallback. */
export function createFlankiActor(
  id: string,
  models: Map<string, GLTF>,
): {
  root: THREE.Group;
  animator?: NpcAnimator;
  groundFeet: () => void;
  dispose: () => void;
} {
  const root = new THREE.Group();
  root.name = `Flanki_NPC_${id}`;
  root.userData.flankiActor = true;
  const model = models.get(id);
  if (!model)
    return { root, animator: undefined, groundFeet: () => {}, dispose: () => root.removeFromParent() };
  const visual = clone(model.scene);
  const animator = new NpcAnimator(visual, model.animations);
  animator.update(0);
  // Fit outside the animated hierarchy so clip position tracks cannot undo normalization.
  const fitted = new THREE.Group();
  fitted.add(visual);
  root.add(fitted);
  root.updateMatrixWorld(true);
  // Cached SkinnedMesh bounding boxes can describe another pose; measure deformed vertices.
  const box = new THREE.Box3().setFromObject(fitted, true);
  const height = Math.max(0.01, box.max.y - box.min.y);
  fitted.scale.multiplyScalar(2.45 / height);
  fitted.scale.x *= NPC_BODY_WIDTH_SCALE;
  fitted.scale.z *= NPC_BODY_DEPTH_SCALE;
  root.updateMatrixWorld(true);
  box.setFromObject(fitted, true);
  fitted.position.y -= box.min.y;
  root.updateMatrixWorld(true);
  visual.traverse((object) => {
    if (object instanceof THREE.Mesh) object.castShadow = object.receiveShadow = true;
    if (object instanceof THREE.SkinnedMesh) object.frustumCulled = false;
  });
  // Sample sole vertices, not bone origins (rig pivots need not coincide with the mesh).
  // This avoids a full precise SkinnedMesh bounds scan on every frame.
  const point = new THREE.Vector3();
  const origin = new THREE.Vector3();
  const samples: { mesh: THREE.Mesh; indices: number[] }[] = [];
  root.updateMatrixWorld(true);
  const soleY = new THREE.Box3().setFromObject(root, true).min.y;
  visual.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const vertices = object.geometry.getAttribute('position');
    if (!vertices) return;
    const candidates: number[] = [];
    for (let index = 0; index < vertices.count; index++) {
      object.getVertexPosition(index, point).applyMatrix4(object.matrixWorld);
      if (point.y <= soleY + 0.12) candidates.push(index);
    }
    if (candidates.length) {
      const stride = Math.max(1, Math.floor(candidates.length / 64));
      samples.push({
        mesh: object,
        indices: candidates.filter((_, index) => index % stride === 0).slice(0, 64),
      });
    }
  });
  const groundFeet = () => {
    if (!samples.length) return;
    root.parent?.updateWorldMatrix(true, false);
    root.updateMatrixWorld(true);
    root.getWorldPosition(origin);
    let lowest = Infinity;
    for (const { mesh, indices } of samples) {
      for (const index of indices) {
        mesh.getVertexPosition(index, point).applyMatrix4(mesh.matrixWorld);
        lowest = Math.min(lowest, point.y);
      }
    }
    fitted.position.y -= lowest - origin.y;
    root.updateMatrixWorld(true);
  };
  const dispose = () => {
    animator.dispose();
    const skeletons = new Set<THREE.Skeleton>();
    visual.traverse((object) => {
      if (object instanceof THREE.SkinnedMesh) skeletons.add(object.skeleton);
    });
    skeletons.forEach((skeleton) => skeleton.dispose());
    root.removeFromParent();
  };
  return { root, animator, groundFeet, dispose };
}
