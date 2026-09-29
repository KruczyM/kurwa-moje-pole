/** Offline only: a texture-reviewed mask, never a global body-height selection. */
import * as THREE from 'three';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export function repairZaworClothWeights(root: THREE.Object3D) {
  const masks = JSON.parse(readFileSync('reports/zawor-cloth-analysis/mask.json', 'utf8')) as {
    positionSha256: string; count: number; vertices: number[];
  }[];
  root.updateMatrixWorld(true);
  root.traverse(o => { if (o instanceof THREE.SkinnedMesh) o.skeleton.update(); });
  const box = new THREE.Box3().setFromObject(root);
  const height = box.max.y - box.min.y;
  let primitive = 0;
  root.traverse(mesh => {
    if (!(mesh instanceof THREE.SkinnedMesh)) return;
    const p = mesh.geometry.getAttribute('position');
    const mask = masks[primitive++];
    const hash = createHash('sha256').update(Buffer.from(p.array.buffer, p.array.byteOffset, p.array.byteLength)).digest('hex');
    if (!mask || mask.count !== p.count || hash !== mask.positionSha256) throw new Error('Clothing mask does not match geometry');
    const spine = mesh.skeleton.bones.findIndex(b => /Spine2$/.test(b.name));
    if (spine < 0) throw new Error('Missing cloth attachment');
    const joints = mesh.geometry.getAttribute('skinIndex');
    const weights = mesh.geometry.getAttribute('skinWeight');
    // Cache positions before changing any weights.
    const points = mask.vertices.map(i => mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld));
    mask.vertices.forEach((i, n) => {
      const y = (points[n].y - box.min.y) / height;
      const blend = 1 - THREE.MathUtils.smoothstep(y, .56, .63);
      const values = new Map<number, number>();
      for (let c = 0; c < 4; c++) {
        const j = joints.getComponent(i, c);
        values.set(j, (values.get(j) ?? 0) + weights.getComponent(i, c) * (1 - blend));
      }
      values.set(spine, (values.get(spine) ?? 0) + blend);
      const packed = [...values].sort((a,b) => b[1] - a[1]).slice(0,4);
      const sum = packed.reduce((s,v) => s + v[1], 0);
      for (let c = 0; c < 4; c++) {
        joints.setComponent(i,c,packed[c]?.[0] ?? 0);
        weights.setComponent(i,c,(packed[c]?.[1] ?? 0) / sum);
      }
    });
    joints.needsUpdate = weights.needsUpdate = true;
  });
  if (primitive !== masks.length) throw new Error('Unexpected cloth primitive count');
}
