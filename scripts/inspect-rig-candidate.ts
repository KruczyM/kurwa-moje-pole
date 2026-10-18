import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FestivalMotionBank } from '../src/game/animation/FestivalMotionBank';
const bytes = readFileSync(process.argv[2]);
const loader = new GLTFLoader();
loader.register(() => ({ name: 'images', loadTexture: () => Promise.resolve(new THREE.Texture()) }));
const model = await loader.parseAsync(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  '',
);
model.scene.updateMatrixWorld(true);
model.scene.traverse((o) => {
  if (o instanceof THREE.SkinnedMesh) o.skeleton.update();
});
const box = new THREE.Box3().setFromObject(model.scene),
  h = box.max.y - box.min.y;
console.log('Bounds', box.min.toArray(), box.max.toArray());
console.log('Precise', new THREE.Box3().setFromObject(model.scene, true));
model.scene.traverse((o) => {
  if (o instanceof THREE.SkinnedMesh) {
    const raw = new THREE.Box3(),
      skin = new THREE.Box3();
    for (let i = 0; i < o.geometry.attributes.position.count; i++) {
      raw.expandByPoint(
        new THREE.Vector3()
          .fromBufferAttribute(o.geometry.attributes.position, i)
          .applyMatrix4(o.matrixWorld),
      );
      skin.expandByPoint(o.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(o.matrixWorld));
    }
    console.log(
      o.name,
      'raw',
      raw,
      'skin',
      skin,
      'matrix',
      o.matrixWorld.elements,
      'bind',
      o.bindMatrix.elements,
    );
  }
});
for (const b of model.scene.getObjectsByProperty('isBone', true))
  console.log(
    b.name,
    b
      .getWorldPosition(new THREE.Vector3())
      .toArray()
      .map((v, i) => (v - (i === 1 ? box.min.y : 0)) / h),
  );
if (process.argv.includes('--motion')) {
  const donorBytes = readFileSync('public/game-assets/animations/festival-motion-bank.glb');
  const donor = await loader.parseAsync(
    donorBytes.buffer.slice(donorBytes.byteOffset, donorBytes.byteOffset + donorBytes.byteLength),
    '',
  );
  const rest = new Map<THREE.SkinnedMesh, THREE.Vector3[]>();
  model.scene.traverse((o) => {
    if (o instanceof THREE.SkinnedMesh)
      rest.set(
        o,
        Array.from({ length: o.geometry.attributes.position.count }, (_, i) =>
          o.getVertexPosition(i, new THREE.Vector3()),
        ),
      );
  });
  new FestivalMotionBank(donor).apply(model);
  const mixer = new THREE.AnimationMixer(model.scene);
  mixer.clipAction(model.animations.find((c) => c.name === 'Walk')!).play();
  mixer.update(0.4);
  model.scene.updateMatrixWorld(true);
  for (const [mesh, points] of rest) {
    mesh.skeleton.update();
    const p = points.map((_, i) => mesh.getVertexPosition(i, new THREE.Vector3()));
    const ix = mesh.geometry.index!;
    const edges = [];
    for (let i = 0; i < ix.count; i += 3)
      for (let c = 0; c < 3; c++) {
        const a = ix.getX(i + c),
          b = ix.getX(i + ((c + 1) % 3)),
          d = points[a].distanceTo(points[b]);
        if (d > 0.005) edges.push({ a, b, ratio: p[a].distanceTo(p[b]) / d });
      }
    for (const edge of edges.sort((a, b) => b.ratio - a.ratio).slice(0, 5)) {
      console.log('EDGE', edge);
      for (const i of [edge.a, edge.b])
        console.log(
          i,
          points[i].toArray(),
          Array.from({ length: 4 }, (_, c) => [
            mesh.skeleton.bones[mesh.geometry.attributes.skinIndex.getComponent(i, c)].name,
            mesh.geometry.attributes.skinWeight.getComponent(i, c),
          ]),
        );
    }
  }
}
