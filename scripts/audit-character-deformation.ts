/** Bake the actual Three.js skinning result for offline geometry inspection. */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FestivalMotionBank } from '../src/game/animation/FestivalMotionBank';
import { repairSkinSeams } from '../src/game/animation/repairSkinSeams';
import { repairDraftArmSkin, DRAFT_ARM_MODELS } from '../src/game/animation/repairDraftArmSkin';
import { refitDraftShoulders } from '../src/game/animation/refitDraftShoulders';
import catalog from '../src/game/assets/assetCatalog.json';
import { repairKlatwaSkin } from '../src/game/animation/repairKlatwaSkin';
import { shoulderRepairAssets } from '../src/game/animation/shoulderRepairCatalog';
import { amperPreviewPose } from '../src/game/ui/amperPreviewPose';
import { repairDinosaurSkin } from '../src/game/animation/repairDinosaurSkin';
import { smoothSkinWeights } from '../src/game/animation/smoothSkinWeights';

async function load(path: string) {
  const candidate = process.env.AUDIT_SOURCE ? `${process.env.AUDIT_SOURCE}/${path}` : '';
  const bytes = readFileSync(candidate && existsSync(candidate) ? candidate : `public/game-assets/${path}`);
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'audit-images', loadTexture: () => Promise.resolve(new THREE.Texture()) }));
  return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
}
const bank = new FestivalMotionBank(await load('animations/festival-motion-bank.glb'));
const out = process.argv[2] ?? 'reports/arm-deformation';
mkdirSync(out, { recursive: true });
const output = [];
for (const asset of [
  ...catalog.characters.map((a) => ({ ...a, path: `characters/${a.id}/npc-animations.glb` })),
  ...catalog.festivalNpcs,
  { id: 'klatwa-new-preview', path: 'characters/klatwa/new-preview-animations.glb' },
  { id: 'amper-preview', path: 'characters/amper/preview.glb' },
]) {
  if (process.env.AUDIT_IDS && !process.env.AUDIT_IDS.split(',').includes(asset.id)) continue;
  if (process.argv.includes('--reviewed') && !shoulderRepairAssets.some((a) => a.id === asset.id)) continue;
  const model = await load(asset.path);
  if (process.env.AUDIT_ARM_POSE_DEGREES)
    model.scene.userData.armPoseCorrectionRadians = THREE.MathUtils.degToRad(
      Number(process.env.AUDIT_ARM_POSE_DEGREES),
    );
  if (process.argv.includes('--dinosaur-weights') && asset.id === '019_punk_spikes_bracelets')
    repairDinosaurSkin(model.scene);
  if (asset.id === 'ambona' && process.argv.includes('--ambona-pose'))
    model.scene.userData.armPoseCorrectionRadians = Math.PI / 6;
  if (process.argv.includes('--refit'))
    refitDraftShoulders(model, Number(process.env.AUDIT_SHOULDER_LIFT ?? 0));
  repairSkinSeams(model.scene, process.argv.includes('--repair'));
  if (process.argv.includes('--smooth-only'))
    model.scene.traverse((object) => {
      if (object instanceof THREE.SkinnedMesh) smoothSkinWeights(object);
    });
  if (process.argv.includes('--arms'))
    repairDraftArmSkin(
      model.scene,
      process.argv.includes('--upper-chest') || DRAFT_ARM_MODELS.some((id) => id === asset.id),
      process.argv.includes('--upper-chest'),
    );
  const original = model.animations;
  if (process.argv.includes('--klatwa')) {
    repairDraftArmSkin(model.scene, true);
    repairKlatwaSkin(model.scene);
  }
  bank.apply(model);
  if (process.argv.includes('--amper-menu') && ['zawor', 'korba'].includes(asset.id)) {
    const donor = await load('characters/amper/preview.glb');
    model.animations = [amperPreviewPose(model.scene, donor.scene, donor.animations, asset.id)];
  }
  const modes = process.env.AUDIT_MODES
    ? process.env.AUDIT_MODES.split(',')
    : process.env.AUDIT_MODE
      ? [process.env.AUDIT_MODE]
      : process.env.AUDIT_REST
        ? ['rest', 'original', 'bank']
        : ['original', 'bank'];
  const times = (process.env.AUDIT_TIMES ?? '0.4').split(',').map(Number);
  if (times.some((time) => !Number.isFinite(time) || time < 0)) throw new Error('Invalid AUDIT_TIMES');
  for (const { mode, time } of modes.flatMap((mode) =>
    (mode === 'rest' ? [0] : times).map((time) => ({ mode, time })),
  )) {
    const mixer = new THREE.AnimationMixer(model.scene);
    const clipName = process.env.AUDIT_CLIP ?? 'Idle';
    const clip = (mode === 'original' ? original : model.animations).find((c) => c.name === clipName)!;
    if (mode !== 'rest') mixer.clipAction(clip).play();
    mixer.update(time);
    model.scene.updateMatrixWorld(true);
    const vertices: number[][] = [],
      faces: number[][] = [];
    model.scene.traverse((object) => {
      if (!(object instanceof THREE.SkinnedMesh)) return;
      object.skeleton.update();
      const start = vertices.length;
      const count = object.geometry.getAttribute('position').count;
      for (let i = 0; i < count; i++)
        vertices.push(
          object.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(object.matrixWorld).toArray(),
        );
      const index = object.geometry.index;
      for (let i = 0; i < (index?.count ?? count); i += 3)
        faces.push([0, 1, 2].map((j) => start + (index ? index.getX(i + j) : i + j)));
    });
    if (process.env.AUDIT_UPPER) {
      const ys = vertices.map((v) => v[1]);
      const low = ys.reduce((a, b) => Math.min(a, b), Infinity),
        high = ys.reduce((a, b) => Math.max(a, b), -Infinity);
      const floor = low + (high - low) * 0.48;
      const keep = faces.filter((f) => f.every((i) => vertices[i][1] >= floor));
      const ids = [...new Set(keep.flat())];
      const remap = new Map(ids.map((id, i) => [id, i]));
      output.push({
        name: `${asset.id} ${mode} ${clipName}`,
        vertices: ids.map((i) => vertices[i]),
        faces: keep.map((f) => f.map((i) => remap.get(i)!)),
      });
    } else output.push({ name: `${asset.id} ${mode} ${clipName} t=${time}`, vertices, faces });
    mixer.stopAllAction();
    mixer.uncacheRoot(model.scene);
  }
}
writeFileSync(`${out}/poses.json`, JSON.stringify(output));
console.log(`Baked ${output.length} poses in ${out}`);
