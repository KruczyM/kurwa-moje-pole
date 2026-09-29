import { existsSync, readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import { disposeObjectTree } from '../lifecycle/disposeThree';

it.each(['npc-animations.glb', 'new-preview-animations.glb'])(
  '%s keeps face rigid and chest free of arm weights',
  async (file) => {
    const path = `characters/klatwa/${file}`;
    const bytes = readFileSync(`public/game-assets/${path}`);
    const backup = `reports/klatwa-skin-repair-20260927/originals/${path}`;
    // Local binary provenance check; CI still always verifies shipped weights.
    if (existsSync(backup)) {
      const before = readFileSync(backup);
      const jsonLength = bytes.readUInt32LE(12);
      const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
      // The entire container must be identical except JOINTS_0 and WEIGHTS_0.
      const masked = Buffer.from(bytes);
      for (const mesh of json.meshes)
        for (const primitive of mesh.primitives) {
          for (const semantic of ['JOINTS_0', 'WEIGHTS_0']) {
            const view = json.bufferViews[json.accessors[primitive.attributes[semantic]].bufferView];
            const start = 28 + jsonLength + (view.byteOffset ?? 0);
            before.copy(masked, start, start, start + view.byteLength);
          }
        }
      expect(masked.equals(before)).toBe(true);
    }
    const loader = new GLTFLoader();
    loader.register(() => ({ name: 'test-images', loadTexture: () => Promise.resolve(new THREE.Texture()) }));
    const model = await loader.parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      '',
    );
    model.scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model.scene);
    const height = bounds.max.y - bounds.min.y;
    let face = 0,
      chest = 0;
    model.scene.traverse((object) => {
      if (!(object instanceof THREE.SkinnedMesh)) return;
      const positions = object.geometry.getAttribute('position'),
        weights = object.geometry.getAttribute('skinWeight'),
        joints = object.geometry.getAttribute('skinIndex');
      const p = new THREE.Vector3();
      for (let i = 0; i < positions.count; i++) {
        p.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
        const x = Math.abs(p.x) / height,
          y = (p.y - bounds.min.y) / height;
        let sum = 0;
        for (let c = 0; c < 4; c++) {
          const w = weights.getComponent(i, c);
          expect(Number.isFinite(w) && w >= 0).toBe(true);
          sum += w;
          if (w < 1e-6) continue;
          const name = object.skeleton.bones[joints.getComponent(i, c)].name;
          if (x < 0.135 && y > 0.7) {
            expect(name.endsWith('Head')).toBe(true);
            face++;
          }
          if (x < 0.135 && y > 0.44 && y < 0.6) {
            expect(name.endsWith('Spine2')).toBe(true);
            chest++;
          }
        }
        expect(sum).toBeCloseTo(1, 5);
      }
    });
    expect(face).toBeGreaterThan(100);
    expect(chest).toBeGreaterThan(100);
    disposeObjectTree(model.scene);
  },
);
