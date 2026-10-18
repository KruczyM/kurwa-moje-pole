import * as THREE from 'three';

/** Groundsheet authored under the fabric deliberately excludes guy ropes and stakes. */
export function tentFootprint(root: THREE.Object3D) {
  let sheet: THREE.Mesh | undefined;
  root.traverse((o) => {
    if (o instanceof THREE.Mesh && /Tent_Groundsheet(?!_LOD)/.test(String(o.userData.runtimeNode ?? o.name)))
      sheet ??= o;
  });
  if (!sheet) return undefined;
  sheet.geometry.computeBoundingBox();
  const bounds = sheet.geometry.boundingBox!;
  const points = [
    [bounds.min.x, bounds.min.z],
    [bounds.max.x, bounds.min.z],
    [bounds.max.x, bounds.max.z],
    [bounds.min.x, bounds.max.z],
  ].map(([x, z]) => {
    const p = new THREE.Vector3(x, bounds.min.y, z).applyMatrix4(sheet!.matrixWorld);
    return { x: p.x, z: p.z };
  });
  const box = new THREE.Box3().setFromObject(sheet);
  return { box, points };
}

export function circleTouchesFootprint(
  x: number,
  z: number,
  radius: number,
  points: { x: number; z: number }[],
) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i],
      b = points[j];
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
    const dx = b.x - a.x,
      dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)));
    if (Math.hypot(x - a.x - t * dx, z - a.z - t * dz) <= radius) return true;
  }
  return inside;
}
