import * as THREE from 'three';

/** Smooth isolated weight spikes over welded topology, not spatial proximity.
 * UV vertices remain separate and separate accessories cannot bleed together. */
export function smoothSkinWeights(mesh: THREE.SkinnedMesh) {
  if (!mesh.skeleton || mesh.skeleton.bones.length < 20) return;
  const g = mesh.geometry,
    p = g.getAttribute('position'),
    w = g.getAttribute('skinWeight'),
    j = g.getAttribute('skinIndex');
  if (!p || !w || !j) return;
  const lookup = new Map<string, number>(),
    representatives: number[] = [];
  const welded = new Uint32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i)},${p.getY(i)},${p.getZ(i)}`;
    let id = lookup.get(key);
    if (id === undefined) {
      id = representatives.length;
      lookup.set(key, id);
      representatives.push(i);
    }
    welded[i] = id;
  }
  const neighbors = representatives.map(() => new Set<number>());
  const index = g.index;
  for (let i = 0; i < (index?.count ?? p.count); i += 3) {
    const triangle = [0, 1, 2].map((k) => welded[index ? index.getX(i + k) : i + k]);
    for (let k = 0; k < 3; k++) {
      const a = triangle[k],
        b = triangle[(k + 1) % 3];
      if (a !== b) {
        neighbors[a].add(b);
        neighbors[b].add(a);
      }
    }
  }
  const count = mesh.skeleton.bones.length;
  const original = new Float32Array(representatives.length * count);
  representatives.forEach((v, i) => {
    for (let c = 0; c < 4; c++) original[i * count + j.getComponent(v, c)] += w.getComponent(v, c);
  });
  let current = original.slice(),
    next = new Float32Array(original.length);
  for (let iteration = 0; iteration < 12; iteration++) {
    for (let i = 0; i < representatives.length; i++) {
      const adjacent = neighbors[i];
      for (let bone = 0; bone < count; bone++) {
        const offset = i * count + bone;
        let sum = 0;
        for (const n of adjacent) sum += current[n * count + bone];
        next[offset] = adjacent.size
          ? original[offset] * 0.15 + current[offset] * 0.35 + (sum / adjacent.size) * 0.5
          : original[offset];
      }
    }
    [current, next] = [next, current];
  }
  const packed = representatives.map((_, i) => {
    const weights = Array.from({ length: count }, (_, bone) => [bone, current[i * count + bone]])
      .sort((a, b) => b[1] - a[1] || a[0] - b[0])
      .slice(0, 4);
    const sum = weights.reduce((s, [, v]) => s + v, 0);
    return weights.map(([bone, v]) => [bone, v / sum]);
  });
  for (let i = 0; i < p.count; i++)
    for (let c = 0; c < 4; c++) {
      j.setComponent(i, c, packed[welded[i]][c][0]);
      w.setComponent(i, c, packed[welded[i]][c][1]);
    }
  j.needsUpdate = true;
  w.needsUpdate = true;
}
