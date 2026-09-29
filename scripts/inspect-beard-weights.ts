import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
for (const id of ['antena', 'gruczol', 'krwiak', 'pien', 'pierscien', 'zawor', 'kobra', 'hemoroid']) {
  const b = readFileSync(`public/game-assets/characters/${id}/npc-animations.glb`);
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'audit-images', loadTexture: () => Promise.resolve(new THREE.Texture()) }));
  const model = await loader.parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
  model.scene.updateMatrixWorld(true);
  model.scene.traverse((o) => {
    if (o instanceof THREE.SkinnedMesh) o.skeleton.update();
  });
  const box = new THREE.Box3().setFromObject(model.scene),
    h = box.max.y - box.min.y,
    center = box.getCenter(new THREE.Vector3());
  const normalize = (v: THREE.Vector3) =>
    [(v.x - center.x) / h, (v.y - box.min.y) / h, (v.z - center.z) / h].map((v) => +v.toFixed(3));
  const bones = model.scene.getObjectsByProperty('isBone', true);
  console.log(
    id,
    'size',
    box.getSize(new THREE.Vector3()).toArray(),
    Object.fromEntries(
      bones
        .filter((b) => /Head$|Neck$|Spine2$/.test(b.name))
        .map((b) => [b.name, normalize(b.getWorldPosition(new THREE.Vector3()))]),
    ),
  );
}
