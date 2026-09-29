import * as THREE from 'three';

const nameOf = (bone: THREE.Bone) => bone.name.replace(/^mixamorig[:_]?/i, '');

/** Reject remote joint influences left by automatic weighting of disconnected
 * garment islands. Work in skin bind space, never in the currently animated pose. */
export function repairSkinInfluences(mesh: THREE.SkinnedMesh) {
  if (!mesh.skeleton) return 0;
  const { bones, boneInverses } = mesh.skeleton;
  const names = bones.map(nameOf);
  const hips = names.indexOf('Hips'),
    head = names.indexOf('Head');
  const foot = names.indexOf('LeftFoot');
  if (hips < 0 || head < 0 || foot < 0) return 0;
  const points = boneInverses.map((inverse) =>
    new THREE.Vector3().setFromMatrixPosition(inverse.clone().invert()),
  );
  const height = points[head].distanceTo(points[foot]) * 1.2;
  if (!(height > 0)) return 0;
  const up = points[head].clone().sub(points[hips]).normalize();
  const neck = names.indexOf('Neck');
  const leftArm = names.indexOf('LeftArm'),
    rightArm = names.indexOf('RightArm');
  const across =
    leftArm >= 0 && rightArm >= 0
      ? points[leftArm].clone().sub(points[rightArm]).normalize()
      : new THREE.Vector3(1, 0, 0);
  const headRadius =
    leftArm >= 0 && rightArm >= 0 ? points[leftArm].distanceTo(points[rightArm]) * 0.4 : height * 0.12;
  const ends = points.map((point, i) => {
    const children = bones[i].children.filter((child) => child instanceof THREE.Bone) as THREE.Bone[];
    const preferred = children.find((child) => /^(Spine\d*|Neck|Head)$/.test(nameOf(child))) ?? children[0];
    if (preferred) return points[bones.indexOf(preferred)].clone();
    if (i === head) return point.clone().addScaledVector(up, height * 0.16);
    const parent = bones.indexOf(bones[i].parent as THREE.Bone);
    return parent >= 0
      ? point.clone().addScaledVector(point.clone().sub(points[parent]), 0.3)
      : point.clone();
  });
  const position = mesh.geometry.getAttribute('position');
  const indices = mesh.geometry.getAttribute('skinIndex');
  const weights = mesh.geometry.getAttribute('skinWeight');
  if (!position || !indices || !weights) return 0;
  const p = new THREE.Vector3(),
    segment = new THREE.Vector3(),
    delta = new THREE.Vector3();
  const distances = new Float64Array(bones.length);
  let corrected = 0;
  for (let vertex = 0; vertex < position.count; vertex++) {
    p.fromBufferAttribute(position, vertex).applyMatrix4(mesh.bindMatrix);
    // The cranium/hats must not follow nearby upper-arm bones in a T-pose.
    if (
      neck >= 0 &&
      delta.subVectors(p, points[neck]).dot(up) > height * 0.035 &&
      Math.abs(delta.dot(across)) < headRadius
    ) {
      for (let channel = 0; channel < 4; channel++) {
        indices.setComponent(vertex, channel, channel === 0 ? head : 0);
        weights.setComponent(vertex, channel, channel === 0 ? 1 : 0);
      }
      corrected++;
      continue;
    }
    let nearest = Infinity;
    for (let i = 0; i < bones.length; i++) {
      segment.subVectors(ends[i], points[i]);
      const t = THREE.MathUtils.clamp(
        delta.subVectors(p, points[i]).dot(segment) / Math.max(segment.lengthSq(), 1e-20),
        0,
        1,
      );
      distances[i] = delta.copy(points[i]).addScaledVector(segment, t).distanceTo(p);
      nearest = Math.min(nearest, distances[i]);
    }
    let remote = false;
    for (let channel = 0; channel < 4; channel++) {
      if (
        weights.getComponent(vertex, channel) > 0.025 &&
        distances[indices.getComponent(vertex, channel)] > nearest + height * 0.12
      )
        remote = true;
    }
    if (!remote) continue;
    const candidates = [...distances.keys()].sort((a, b) => distances[a] - distances[b]).slice(0, 4);
    const raw = candidates.map((i) => 1 / Math.max(distances[i], height * 0.012) ** 4);
    const total = raw.reduce((a, b) => a + b, 0);
    candidates.forEach((bone, channel) => {
      indices.setComponent(vertex, channel, bone);
      weights.setComponent(vertex, channel, raw[channel] / total);
    });
    corrected++;
  }
  if (corrected) {
    indices.needsUpdate = true;
    weights.needsUpdate = true;
  }
  return corrected;
}
