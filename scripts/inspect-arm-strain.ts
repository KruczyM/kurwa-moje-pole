import { readFileSync } from 'node:fs';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
const b = readFileSync('public/game-assets/characters/korba/npc-animations.glb');
const l = new GLTFLoader();
l.register(() => ({ name: 'x', loadTexture: () => Promise.resolve(new T.Texture()) }));
const g = await l.parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
g.scene.updateMatrixWorld(true);
const rest = new Map<T.SkinnedMesh, T.Vector3[]>();
g.scene.traverse((o) => {
  if (o instanceof T.SkinnedMesh) {
    o.skeleton.update();
    rest.set(
      o,
      Array.from({ length: o.geometry.getAttribute('position').count }, (_, i) =>
        o.getVertexPosition(i, new T.Vector3()).applyMatrix4(o.matrixWorld),
      ),
    );
  }
});
const m = new T.AnimationMixer(g.scene);
m.clipAction(g.animations.find((c) => c.name === 'Idle')!).play();
m.update(0.4);
g.scene.updateMatrixWorld(true);
for (const [o, points] of rest) {
  o.skeleton.update();
  const pose = points.map((_, i) => o.getVertexPosition(i, new T.Vector3()).applyMatrix4(o.matrixWorld));
  const idx = o.geometry.index!;
  const edges = [];
  for (let i = 0; i < idx.count; i += 3)
    for (let c = 0; c < 3; c++) {
      const a = idx.getX(i + c),
        b = idx.getX(i + ((c + 1) % 3)),
        old = points[a].distanceTo(points[b]),
        now = pose[a].distanceTo(pose[b]);
      if (old > 0.0001 && now > 0.07) edges.push({ a, b, ratio: now / old, old, now });
    }
  edges.sort((a, b) => b.ratio - a.ratio);
  const weights = (i: number) =>
    [0, 1, 2, 3].map((c) => [
      o.skeleton.bones[o.geometry.getAttribute('skinIndex').getComponent(i, c)].name,
      +o.geometry.getAttribute('skinWeight').getComponent(i, c).toFixed(3),
    ]);
  console.log(
    JSON.stringify(
      edges.slice(0, 12).map((e) => ({
        ...e,
        rest: [points[e.a].toArray(), points[e.b].toArray()],
        weights: [weights(e.a), weights(e.b)],
      })),
      null,
      2,
    ),
  );
}
