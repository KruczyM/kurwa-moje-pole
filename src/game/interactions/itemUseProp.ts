import * as THREE from 'three';
import { findRigBone } from '../animation/rigBones';
import type { EffectId } from '../effects/EffectManager';
import { cloneDisposableModel } from '../lifecycle/disposeThree';
import { itemUseSequenceConfig } from './itemUseSequenceConfig';

/** Recognizable local props for inventory items and failed asset loads; owned by the sequence. */
export function createUsePropFallback(effect: EffectId) {
  const root = new THREE.Group();
  const add = (geometry: THREE.BufferGeometry, color: number, y = 0) => {
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.7 }));
    mesh.position.y = y;
    root.add(mesh);
    return mesh;
  };
  switch (effect) {
    case 'Papieros':
    case 'Joint': {
      add(new THREE.CylinderGeometry(0.045, 0.045, 0.72, 12), 0xf1e6cd, 0.1);
      add(
        new THREE.CylinderGeometry(0.045, 0.045, 0.25, 12),
        effect === 'Papieros' ? 0xbf854e : 0xc3b28c,
        -0.385,
      );
      const ember = add(new THREE.SphereGeometry(0.047, 10, 8), 0xff642a, 0.47);
      ember.name = 'UsePropEmber';
      ember.material.emissive.setHex(0xc63006);
      root.rotation.x = Math.PI / 2;
      break;
    }
    case 'Piwo':
      add(new THREE.CylinderGeometry(0.29, 0.29, 1, 20), 0xc89328);
      add(new THREE.CylinderGeometry(0.27, 0.27, 0.025, 20), 0xb9c0c3, 0.51);
      break;
    case 'Grzyb':
      add(new THREE.CylinderGeometry(0.09, 0.13, 0.7, 12), 0xe6d3aa, -0.16);
      add(new THREE.SphereGeometry(0.4, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0x996333, 0.15);
      break;
    case 'Kreska':
      add(new THREE.BoxGeometry(1, 0.05, 0.7), 0x333e49);
      add(new THREE.BoxGeometry(0.6, 0.045, 0.055), 0xf5f1e7, 0.045);
      break;
    case 'MDMA':
      add(new THREE.CylinderGeometry(0.5, 0.5, 0.24, 20), 0xe09ac6);
      break;
    case 'LSD':
      add(new THREE.BoxGeometry(1, 0.06, 1), 0xdcc5f2);
      break;
  }
  return root;
}

/** Measure the visible hand surface; fall back to finger bones for geometry-free rigs. */
export function handGripPosition(root: THREE.Object3D, hand: THREE.Object3D) {
  root.updateWorldMatrix(true, true);
  // SkinnedMesh updates bindMatrixInverse in updateMatrixWorld, not updateWorldMatrix.
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3();
  const vertex = new THREE.Vector3();
  const handBones = new Set<THREE.Object3D>();
  hand.traverse((bone) => handBones.add(bone));
  root.traverse((object) => {
    const mesh = object as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    const weights = mesh.geometry.attributes.skinWeight;
    const indices = mesh.geometry.attributes.skinIndex;
    if (!weights || !indices) return;
    mesh.skeleton.update();
    for (let index = 0; index < weights.count; index++) {
      let influence = 0;
      for (let component = 0; component < 4; component++) {
        if (handBones.has(mesh.skeleton.bones[indices.getComponent(index, component)])) {
          influence += weights.getComponent(index, component);
        }
      }
      if (influence > 0.5) {
        mesh.getVertexPosition(index, vertex).applyMatrix4(mesh.matrixWorld);
        bounds.expandByPoint(hand.worldToLocal(vertex));
      }
    }
  });
  if (!bounds.isEmpty()) {
    const grip = bounds.getCenter(new THREE.Vector3());
    grip.y = THREE.MathUtils.lerp(bounds.min.y, bounds.max.y, 0.65);
    grip.z = bounds.max.z;
    return grip;
  }
  const index = findRigBone(root, 'mixamorig:RightHandIndex2');
  const thumb = findRigBone(root, 'mixamorig:RightHandThumb2');
  if (index && thumb) {
    const center = index
      .getWorldPosition(new THREE.Vector3())
      .lerp(thumb.getWorldPosition(new THREE.Vector3()), 0.5);
    return hand.worldToLocal(center);
  }
  return new THREE.Vector3(0, 0.065, 0.015).divide(hand.getWorldScale(new THREE.Vector3()));
}

/** Compensates the entire hand hierarchy (including Armature.scale), not just the scene scale. */
export function attachUseProp(root: THREE.Object3D, source: THREE.Object3D | undefined, effect: EffectId) {
  const hand = findRigBone(root, 'mixamorig:RightHand');
  if (!hand) return undefined;
  root.updateWorldMatrix(true, true);
  const config = itemUseSequenceConfig[effect];
  const socket = new THREE.Group();
  socket.name = 'UseProp';
  socket.userData.effect = effect;
  socket.position.copy(handGripPosition(root, hand));
  const handScale = hand.getWorldScale(new THREE.Vector3());
  socket.scale.set(
    1 / Math.max(1e-6, Math.abs(handScale.x)),
    1 / Math.max(1e-6, Math.abs(handScale.y)),
    1 / Math.max(1e-6, Math.abs(handScale.z)),
  );
  socket.position.add(new THREE.Vector3(...config.propPosition).divide(handScale));
  const orientation = new THREE.Group();
  const model = source ? cloneDisposableModel(source) : createUsePropFallback(effect);
  orientation.add(model);
  orientation.rotation.set(...config.propRotation);
  let bounds = new THREE.Box3().setFromObject(orientation);
  if (config.gesture === 'smoke') {
    const size = bounds.getSize(new THREE.Vector3());
    const axis =
      size.x >= size.y && size.x >= size.z
        ? new THREE.Vector3(1, 0, 0)
        : size.y >= size.z
          ? new THREE.Vector3(0, 1, 0)
          : new THREE.Vector3(0, 0, 1);
    orientation.quaternion.premultiply(
      new THREE.Quaternion().setFromUnitVectors(axis, new THREE.Vector3(0, 0, 1)),
    );
    bounds = new THREE.Box3().setFromObject(orientation);
  }
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const scale = config.propSize / Math.max(0.0001, size.x, size.y, size.z);
  // Center AFTER rotation; preserve authored root transforms inside a separate wrapper.
  const normalized = new THREE.Group();
  normalized.name = 'UsePropModel';
  normalized.scale.setScalar(scale);
  orientation.position.copy(center.negate());
  normalized.add(orientation);
  socket.add(normalized);
  socket.visible = false;
  hand.add(socket);
  return socket;
}
