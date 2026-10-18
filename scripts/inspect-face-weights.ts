import { readFileSync } from 'node:fs';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
for (const id of ['hemoroid', 'chlebak']) {
  const b = readFileSync(`public/game-assets/characters/${id}/npc-animations.glb`),
    l = new GLTFLoader();
  l.register(() => ({ name: 'i', loadTexture: () => Promise.resolve(new T.Texture()) }));
  const g = await l.parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
  g.scene.updateMatrixWorld(true);
  g.scene.traverse((o) => {
    if (!(o instanceof T.SkinnedMesh)) return;
    const head = o.skeleton.bones.findIndex((b) => b.name.endsWith('Head')),
      p = o.geometry.getAttribute('position'),
      j = o.geometry.getAttribute('skinIndex'),
      w = o.geometry.getAttribute('skinWeight');
    const samples = [];
    for (let i = 0; i < p.count; i++) {
      if (p.getY(i) < 1.7 || Math.abs(p.getX(i)) > 0.38 || p.getZ(i) < 0.04) continue;
      let weight = 0;
      for (let c = 0; c < 4; c++) if (j.getComponent(i, c) === head) weight += w.getComponent(i, c);
      if (weight < 0.99) samples.push({ p: [p.getX(i), p.getY(i), p.getZ(i)], weight });
    }
    console.log(
      id,
      'head',
      o.skeleton.bones[head].getWorldPosition(new T.Vector3()).toArray(),
      'nonrigid',
      samples.length,
      JSON.stringify(samples.sort((a, b) => a.weight - b.weight).slice(0, 8)),
    );
  });
}
