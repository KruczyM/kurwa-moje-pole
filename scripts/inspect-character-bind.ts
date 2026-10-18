import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
for (const id of process.argv.slice(2)) {
  const bytes = readFileSync(`public/game-assets/characters/${id}/npc-animations.glb`);
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'images', loadTexture: () => Promise.resolve(new THREE.Texture()) }));
  const model = await loader.parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  model.scene.updateMatrixWorld(true);
  console.log(id, new THREE.Box3().setFromObject(model.scene));
  model.scene.traverse((o) => {
    if (!(o instanceof THREE.SkinnedMesh)) return;
    console.log('bind', o.bindMatrix.elements);
    console.log(
      'raw transformed bounds',
      new THREE.Box3()
        .setFromBufferAttribute(o.geometry.getAttribute('position') as THREE.BufferAttribute)
        .applyMatrix4(o.matrixWorld),
    );
    o.skeleton.bones.forEach((b, i) => {
      if (/Head$|Neck$|Spine2$|Left(Shoulder|Arm|ForeArm|Hand)$/.test(b.name))
        console.log(
          b.name,
          'bind',
          new THREE.Vector3().setFromMatrixPosition(o.skeleton.boneInverses[i].clone().invert()).toArray(),
          'world',
          b.getWorldPosition(new THREE.Vector3()).toArray(),
        );
    });
  });
}
