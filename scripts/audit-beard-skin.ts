import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { repairBeardSkin, BEARD_REGIONS } from '../src/game/animation/repairBeardSkin';
const output = [];
const out = 'reports/beard-skin-review';
mkdirSync(out, { recursive: true });
for (const id of Object.keys(BEARD_REGIONS)) {
  const bytes = readFileSync(`public/game-assets/characters/${id}/npc-animations.glb`);
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'audit-images', loadTexture: () => Promise.resolve(new THREE.Texture()) }));
  const model = await loader.parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  const selection = repairBeardSkin(model.scene, id);
  console.log(
    id,
    [...selection.values()].reduce((sum, v) => sum + v.length, 0),
  );
  const mixer = new THREE.AnimationMixer(model.scene);
  mixer.clipAction(model.animations.find((c) => c.name === 'Idle')!).play();
  mixer.update(0.4);
  for (const yaw of [0, 0.55]) {
    const head = model.scene.getObjectsByProperty('isBone', true).find((b) => b.name.endsWith('Head'))!;
    const previous = head.quaternion.clone();
    head.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw));
    model.scene.updateMatrixWorld(true);
    const vertices: number[][] = [],
      faces: number[][] = [],
      selected: number[] = [];
    model.scene.traverse((object) => {
      if (!(object instanceof THREE.SkinnedMesh)) return;
      object.skeleton.update();
      const start = vertices.length,
        count = object.geometry.getAttribute('position').count;
      for (let i = 0; i < count; i++)
        vertices.push(
          object.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(object.matrixWorld).toArray(),
        );
      for (const i of selection.get(object) ?? []) selected.push(start + i);
      const index = object.geometry.index;
      for (let i = 0; i < (index?.count ?? count); i += 3)
        faces.push([0, 1, 2].map((j) => start + (index ? index.getX(i + j) : i + j)));
    });
    output.push({ name: `${id} ${yaw ? 'turn' : 'idle'}`, vertices, faces, selected });
    head.quaternion.copy(previous);
  }
}
writeFileSync(`${out}/poses.json`, JSON.stringify(output));
