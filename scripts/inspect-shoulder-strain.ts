import { readFileSync } from 'node:fs';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
const b = readFileSync(process.argv[2] ?? 'public/game-assets/characters/korba/npc-animations.glb');
const l = new GLTFLoader();
l.register(() => ({ name: 'images', loadTexture: () => Promise.resolve(new T.Texture()) }));
const g = await l.parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
const mixer = new T.AnimationMixer(g.scene);
mixer.clipAction(g.animations.find((c) => c.name === 'Idle')!).play();
mixer.update(0.4);
g.scene.updateMatrixWorld(true);
g.scene.traverse((o) => {
  if (!(o instanceof T.SkinnedMesh)) return;
  o.skeleton.update();
  const p = o.geometry.getAttribute('position'),
    j = o.geometry.getAttribute('skinIndex'),
    w = o.geometry.getAttribute('skinWeight'),
    idx = o.geometry.index!;
  const edges = [];
  for (let n = 0; n < idx.count; n += 3)
    for (let c = 0; c < 3; c++) {
      const i = idx.getX(n + c),
        k = idx.getX(n + ((c + 1) % 3));
      const a = new T.Vector3().fromBufferAttribute(p, i),
        b = new T.Vector3().fromBufferAttribute(p, k);
      if (a.y < 1.3 || a.y > 1.8 || Math.abs(a.x) < 0.2 || Math.abs(a.x) > 0.7) continue;
      const d = a.distanceTo(b);
      if (d < 0.003) continue;
      const now = o.getVertexPosition(i, new T.Vector3()).distanceTo(o.getVertexPosition(k, new T.Vector3()));
      const weights = (v: number) =>
        Array.from({ length: 4 }, (_, c) => [
          o.skeleton.bones[j.getComponent(v, c)].name,
          w.getComponent(v, c),
        ]);
      edges.push({
        ratio: now / d,
        a: a.toArray(),
        b: b.toArray(),
        weightsA: weights(i),
        weightsB: weights(k),
      });
    }
  console.log(JSON.stringify(edges.sort((a, b) => b.ratio - a.ratio).slice(0, 6), null, 2));
});
