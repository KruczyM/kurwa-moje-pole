import * as THREE from 'three';
import { repairSkinInfluences } from './repairSkinInfluences';
import { smoothSkinWeights } from './smoothSkinWeights';

const repairedGeometry = new WeakSet<THREE.BufferGeometry>();

/** UV/normal splits must share skin weights or their formerly coincident
 * vertices separate during animation. Do not weld geometry: that destroys UVs.
 * Called once on loader-owned assets, before they are cloned by consumers. */
export function repairSkinSeams(root: THREE.Object3D, repairDeformation = false) {
  let repaired = 0;
  const seen = new Set<THREE.BufferGeometry>();
  root.traverse((object) => {
    if (
      !(object instanceof THREE.SkinnedMesh) ||
      seen.has(object.geometry) ||
      repairedGeometry.has(object.geometry)
    )
      return;
    if (repairDeformation) repairSkinInfluences(object);
    const geometry = object.geometry;
    seen.add(geometry);
    const position = geometry.getAttribute('position');
    const indices = geometry.getAttribute('skinIndex');
    const weights = geometry.getAttribute('skinWeight');
    if (!position || !indices || !weights) return;
    const groups = new Map<string, number[]>();
    for (let vertex = 0; vertex < position.count; vertex++) {
      // Exact positions: no welding of nearby independent surfaces/accessories.
      const key = `${position.getX(vertex)},${position.getY(vertex)},${position.getZ(vertex)}`;
      const group = groups.get(key);
      if (group) group.push(vertex);
      else groups.set(key, [vertex]);
    }
    let changed = false;
    for (const vertices of groups.values()) {
      if (vertices.length < 2) continue;
      const combined = new Map<number, number>();
      for (const vertex of vertices)
        for (let channel = 0; channel < 4; channel++) {
          const bone = indices.getComponent(vertex, channel);
          const weight = weights.getComponent(vertex, channel);
          if (weight > 0) combined.set(bone, (combined.get(bone) ?? 0) + weight);
        }
      const strongest = [...combined].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 4);
      const sum = strongest.reduce((total, [, weight]) => total + weight, 0);
      if (!(sum > 0)) continue;
      for (const vertex of vertices) {
        let different = false;
        for (let channel = 0; channel < 4; channel++) {
          const bone = strongest[channel]?.[0] ?? 0;
          const weight = Math.fround((strongest[channel]?.[1] ?? 0) / sum);
          if (
            indices.getComponent(vertex, channel) !== bone ||
            weights.getComponent(vertex, channel) !== weight
          )
            different = true;
          indices.setComponent(vertex, channel, bone);
          weights.setComponent(vertex, channel, weight);
        }
        if (different) {
          repaired++;
          changed = true;
        }
      }
    }
    if (changed) {
      indices.needsUpdate = true;
      weights.needsUpdate = true;
    }
    if (repairDeformation) smoothSkinWeights(object);
    repairedGeometry.add(geometry);
  });
  return repaired;
}
