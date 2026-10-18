/** Read-only, scale-independent skin audit using the runtime motion bank. */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import catalog from '../src/game/assets/assetCatalog.json';
import { FestivalMotionBank } from '../src/game/animation/FestivalMotionBank';
import { repairSkinSeams } from '../src/game/animation/repairSkinSeams';
import { disposeObjectTree } from '../src/game/lifecycle/disposeThree';
async function load(path: string) {
  const bytes = readFileSync(`public/game-assets/${path}`);
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'audit-images', loadTexture: () => Promise.resolve(new THREE.Texture()) }));
  return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
}
const source = await load('animations/festival-motion-bank.glb');
const bank = new FestivalMotionBank(source);
const assets = [...catalog.characters, ...catalog.stagedCharacters]
  .map((a) => ({ id: a.id, path: `characters/${a.id}/npc-animations.glb` }))
  .concat(catalog.festivalNpcs);
const out = process.argv[2] ?? 'reports/npc-deformation-20261003';
mkdirSync(out, { recursive: true });
const results: {
  id: string;
  clips: number;
  worst: { clip: string; phase: number; ratio: number };
  stretchedSamples: number;
  invalidWeights: number;
}[] = [];
for (const asset of assets) {
  const model = await load(asset.path);
  repairSkinSeams(model.scene);
  model.scene.updateMatrixWorld(true);
  let invalidWeights = 0;
  const meshes: { mesh: THREE.SkinnedMesh; edges: { a: number; b: number; length: number }[] }[] = [];
  model.scene.traverse((o) => {
    if (!(o instanceof THREE.SkinnedMesh)) return;
    o.skeleton.update();
    const p = o.geometry.getAttribute('position'),
      w = o.geometry.getAttribute('skinWeight'),
      j = o.geometry.getAttribute('skinIndex'),
      ix = o.geometry.index;
    const points = Array.from({ length: p.count }, (_, i) =>
      o.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(o.matrixWorld),
    );
    const height = new THREE.Box3().setFromPoints(points).getSize(new THREE.Vector3()).length();
    for (let i = 0; i < p.count; i++) {
      let sum = 0;
      for (let c = 0; c < 4; c++) {
        const v = w.getComponent(i, c);
        sum += v;
        if (!Number.isFinite(v) || v < 0 || j.getComponent(i, c) >= o.skeleton.bones.length) invalidWeights++;
      }
      if (Math.abs(sum - 1) > 0.001) invalidWeights++;
    }
    const edges: { a: number; b: number; length: number }[] = [];
    const count = ix?.count ?? p.count,
      step = Math.max(1, Math.floor(count / 3 / 600)) * 3;
    for (let i = 0; i + 2 < count; i += step) {
      const a = ix ? ix.getX(i) : i,
        b = ix ? ix.getX(i + 1) : i + 1;
      const length = points[a].distanceTo(points[b]);
      if (length > height * 0.0005) edges.push({ a, b, length });
    }
    meshes.push({ mesh: o, edges });
  });
  bank.apply(model);
  const mixer = new THREE.AnimationMixer(model.scene);
  const row = {
    id: asset.id,
    clips: model.animations.length,
    worst: { clip: '', phase: 0, ratio: 0 },
    stretchedSamples: 0,
    invalidWeights,
  };
  const a = new THREE.Vector3(),
    b = new THREE.Vector3();
  for (const clip of model.animations) {
    mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1).play();
    for (const phase of [0.05, 0.35, 0.65, 0.95]) {
      mixer.setTime(clip.duration * phase);
      model.scene.updateMatrixWorld(true);
      for (const { mesh, edges } of meshes) {
        mesh.skeleton.update();
        for (const edge of edges) {
          mesh.getVertexPosition(edge.a, a).applyMatrix4(mesh.matrixWorld);
          mesh.getVertexPosition(edge.b, b).applyMatrix4(mesh.matrixWorld);
          const ratio = a.distanceTo(b) / edge.length;
          if (!Number.isFinite(ratio)) throw new Error(`Non-finite skin: ${asset.id}/${clip.name}`);
          if (ratio > 3) row.stretchedSamples++;
          if (ratio > row.worst.ratio) row.worst = { clip: clip.name, phase, ratio };
        }
      }
    }
    mixer.stopAllAction();
  }
  mixer.uncacheRoot(model.scene);
  disposeObjectTree(model.scene);
  results.push(row);
  writeFileSync(
    `${out}/report.json`,
    JSON.stringify(
      {
        note: 'Heuristic samples, not visual acceptance. Edge stretch may also occur in authored geometry.',
        results,
      },
      null,
      2,
    ),
  );
  console.log(
    `${results.length}/${assets.length} ${asset.id}: ${row.worst.clip} ${row.worst.ratio.toFixed(1)}x`,
  );
}
disposeObjectTree(source.scene);
