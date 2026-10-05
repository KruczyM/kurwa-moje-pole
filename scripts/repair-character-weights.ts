/** Bake corrected weights only. Textures, positions, skeletons and clips stay byte-identical. */
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { repairSkinSeams } from '../src/game/animation/repairSkinSeams';
import { smoothSkinWeights } from '../src/game/animation/smoothSkinWeights';
import { BEARD_REGIONS, repairBeardSkin } from '../src/game/animation/repairBeardSkin';
import { repairDraftArmSkin, DRAFT_ARM_MODELS } from '../src/game/animation/repairDraftArmSkin';
import {
  shoulderRepairAssets,
  raisedShoulderAssets,
  shoulderLiftForAsset,
} from '../src/game/animation/shoulderRepairCatalog';
import { refitDraftShoulders } from '../src/game/animation/refitDraftShoulders';
import catalog from '../src/game/assets/assetCatalog.json';
import { repairKlatwaSkin } from '../src/game/animation/repairKlatwaSkin';
import { repairDraftHeadSkin } from '../src/game/animation/repairDraftHeadSkin';
import { repairNpcProps, rigidPropAssets } from '../src/game/animation/repairNpcProps';
import { repairZaworPoncho } from '../src/game/animation/repairZaworPoncho';
import { repairZaworClothWeights } from './repair-zawor-cloth-weights';
import { repairZaworShoulderCaps, refitZaworCapPivots } from '../src/game/animation/repairZaworShoulderCaps';

const install = process.argv.includes('--install');
const smoothCandidate = process.argv.includes('--smooth-candidate');
const candidateSource = process.argv.find((arg) => arg.startsWith('--source-root='))?.slice(14);
if (smoothCandidate && (install || !candidateSource))
  throw new Error('Smoothing candidates requires --source-root and forbids --install');
const beards = process.argv.includes('--beards');
const arms = process.argv.includes('--arms');
const klatwa = process.argv.includes('--klatwa');
const props = process.argv.includes('--props');
const legacyShoulders = process.argv.includes('--legacy-shoulders');
const ambonaPose = process.argv.includes('--ambona-pose');
const poncho = process.argv.includes('--zawor-poncho');
const caps = process.argv.includes('--zawor-shoulders');
const cloth = process.argv.includes('--zawor-cloth');
if (cloth && install)
  throw new Error('Clothing candidate is not approved: side fringe attachment and Run intersections remain.');
if (poncho && install)
  throw new Error('Poncho candidate is not approved: Run deformation still requires repair.');
const selectedIds = process.argv
  .find((arg) => arg.startsWith('--ids='))
  ?.slice(6)
  .split(',');
if (smoothCandidate && (selectedIds?.length !== 1 || selectedIds[0] !== '019_punk_spikes_bracelets'))
  throw new Error('This reviewed candidate profile is restricted to NPC019');
const root = resolve('public/game-assets');
const report = resolve(
  smoothCandidate
    ? 'reports/npc019-smoothed-candidate-20261004'
    : cloth
      ? 'reports/zawor-cloth-weights-20260929'
      : caps
        ? 'reports/zawor-shoulder-caps-20260929'
        : poncho
          ? 'reports/zawor-poncho-20260928'
          : ambonaPose
            ? 'reports/ambona-pose-20260928'
            : legacyShoulders
              ? 'reports/legacy-shoulders-20260928'
              : props
                ? 'reports/npc-prop-repair-20260928'
                : klatwa
                  ? 'reports/klatwa-skin-repair-20260927'
                  : arms
                    ? 'reports/shoulder-rig-repair-20260926'
                    : beards
                      ? 'reports/beard-weight-repair-20260926'
                      : 'reports/skin-weight-repair-20260926',
);
const paths =
  poncho || caps || cloth
    ? ['characters/zawor/npc-animations.glb']
    : ambonaPose
      ? ['characters/ambona/npc-animations.glb']
      : legacyShoulders
        ? ['pien', 'zawor'].map((id) => `characters/${id}/npc-animations.glb`)
        : props
          ? rigidPropAssets.map((asset) => asset.path)
          : klatwa
            ? ['characters/klatwa/npc-animations.glb', 'characters/klatwa/new-preview-animations.glb']
            : arms
              ? shoulderRepairAssets.map((asset) => asset.path)
              : beards
                ? Object.keys(BEARD_REGIONS).map((id) => `characters/${id}/npc-animations.glb`)
                : [
                    ...catalog.characters.map((a) => `characters/${a.id}/npc-animations.glb`),
                    ...catalog.festivalNpcs.map((a) => a.path),
                    'characters/klatwa/new-preview-animations.glb',
                  ];
mkdirSync(report, { recursive: true });
const results = [];
for (const path of paths) {
  const assetId = path.split('/')[1].replace(/\.glb$/, '');
  if (selectedIds && !selectedIds.some((id) => id === assetId || path.split('/').includes(id))) continue;
  const target = resolve(root, path),
    backup = resolve(report, 'originals', path),
    output = resolve(report, 'corrected', path);
  if (!target.startsWith(root + '/') && !target.startsWith(root + '\\'))
    throw new Error('Outside asset directory');
  mkdirSync(dirname(backup), { recursive: true });
  const prior = resolve('reports/shoulder-weight-repair-20260926/originals', path);
  if (!existsSync(backup)) copyFileSync(arms && existsSync(prior) ? prior : target, backup);
  const bytes = readFileSync(smoothCandidate ? resolve(candidateSource!, path) : backup),
    jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  const binaryStart = 20 + jsonLength + 8;
  const loader = new GLTFLoader();
  loader.register(() => ({
    name: 'offline-images',
    loadTexture: () => Promise.resolve(new THREE.Texture()),
  }));
  const model = await loader.parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  if (smoothCandidate) {
    repairSkinSeams(model.scene);
    model.scene.traverse((object) => {
      if (object instanceof THREE.SkinnedMesh) smoothSkinWeights(object);
    });
    const scene = json.scenes[json.scene ?? 0];
    scene.extras = { ...scene.extras, armPoseCorrectionRadians: THREE.MathUtils.degToRad(66) };
  }
  if (
    !smoothCandidate &&
    !beards &&
    !arms &&
    !klatwa &&
    !props &&
    !legacyShoulders &&
    !ambonaPose &&
    !poncho &&
    !caps &&
    !cloth
  )
    repairSkinSeams(model.scene, true);
  if (ambonaPose) {
    const scene = json.scenes[json.scene ?? 0];
    scene.extras = { ...scene.extras, armPoseCorrectionRadians: Math.PI / 6 };
  }
  if (props) {
    // Protect the head first; the prop mask must win where a held object
    // extends above head height. Reversing these passes tears the prop.
    repairDraftHeadSkin(model.scene);
    const asset = rigidPropAssets.find((asset) => asset.path === path)!;
    if (!repairNpcProps(model.scene, asset.id)) throw new Error(`Empty prop mask: ${asset.id}`);
    repairSkinSeams(model.scene);
  }
  if (klatwa) {
    repairDraftArmSkin(model.scene, true);
    repairKlatwaSkin(model.scene);
    repairSkinSeams(model.scene);
  }
  const refitted =
    !cloth &&
    (caps || legacyShoulders || (!beards && shoulderRepairAssets.some((asset) => asset.path === path)));
  if (caps) refitZaworCapPivots(model);
  else if (refitted) {
    const raised = legacyShoulders || raisedShoulderAssets.some((asset) => asset.path === path);
    refitDraftShoulders(model, legacyShoulders ? 0.02 : shoulderLiftForAsset(assetId), legacyShoulders);
    repairDraftArmSkin(
      model.scene,
      raised || DRAFT_ARM_MODELS.some((id) => path === `characters/${id}/npc-animations.glb`),
      raised,
      legacyShoulders,
    );
  }
  // Final pass, after diffusion: beard tips must not regain torso influences.
  if (refitted) repairDraftHeadSkin(model.scene, assetId);
  if (!caps && !cloth) repairBeardSkin(model.scene, assetId);
  if (caps && !repairZaworShoulderCaps(model.scene)) throw new Error('Empty shoulder cap selection');
  if (poncho) repairZaworPoncho(model.scene);
  if (cloth) repairZaworClothWeights(model.scene);
  let patched = 0;
  model.scene.traverse((object) => {
    // Pose metadata only: do not reserialize loader-normalized weight values.
    if (ambonaPose) return;
    if (!(object instanceof THREE.SkinnedMesh)) return;
    const association = model.parser.associations.get(object);
    if (association?.meshes === undefined || association.primitives === undefined)
      throw new Error(`No primitive mapping: ${path}`);
    const primitive = json.meshes[association.meshes].primitives[association.primitives];
    for (const [semantic, name] of [
      ['JOINTS_0', 'skinIndex'],
      ['WEIGHTS_0', 'skinWeight'],
    ]) {
      const accessor = json.accessors[primitive.attributes[semantic]],
        view = json.bufferViews[accessor.bufferView];
      if (accessor.sparse || accessor.normalized || view.buffer !== 0)
        throw new Error(`Unsupported weight accessor ${path}`);
      const size =
        accessor.componentType === 5126
          ? 4
          : accessor.componentType === 5123
            ? 2
            : accessor.componentType === 5121
              ? 1
              : 0;
      if (!size || accessor.type !== 'VEC4') throw new Error('Unsupported skin storage');
      const attribute = object.geometry.getAttribute(name);
      if (attribute.count !== accessor.count) throw new Error('Vertex count changed');
      for (let i = 0; i < attribute.count; i++)
        for (let c = 0; c < 4; c++) {
          const offset =
            binaryStart +
            (view.byteOffset ?? 0) +
            (accessor.byteOffset ?? 0) +
            i * (view.byteStride ?? size * 4) +
            c * size;
          const value = attribute.getComponent(i, c);
          if (!Number.isFinite(value)) throw new Error(`Invalid weight ${path}`);
          if (accessor.componentType === 5126) bytes.writeFloatLE(value, offset);
          else if (size === 2) bytes.writeUInt16LE(value, offset);
          else bytes.writeUInt8(value, offset);
        }
    }
    patched++;
  });
  if (!patched && !ambonaPose) throw new Error(`No patched meshes ${path}`);
  if (refitted) {
    const writeFloats = (accessorId: number, values: ArrayLike<number>, width: number) => {
      const accessor = json.accessors[accessorId],
        view = json.bufferViews[accessor.bufferView];
      if (accessor.componentType !== 5126 || accessor.sparse || values.length !== accessor.count * width)
        throw new Error('Unsupported rig accessor');
      for (let i = 0; i < accessor.count; i++)
        for (let c = 0; c < width; c++)
          bytes.writeFloatLE(
            values[i * width + c],
            binaryStart +
              (view.byteOffset ?? 0) +
              (accessor.byteOffset ?? 0) +
              i * (view.byteStride ?? width * 4) +
              c * 4,
          );
      if (accessor.min)
        accessor.min = Array.from({ length: width }, (_, c) =>
          Math.min(...Array.from({ length: accessor.count }, (_, i) => values[i * width + c])),
        );
      if (accessor.max)
        accessor.max = Array.from({ length: width }, (_, c) =>
          Math.max(...Array.from({ length: accessor.count }, (_, i) => values[i * width + c])),
        );
    };
    const nodeBones = new Map<number, THREE.Bone>();
    model.scene.traverse((o) => {
      if (!(o instanceof THREE.Bone)) return;
      const node = model.parser.associations.get(o)?.nodes;
      if (node === undefined) throw new Error('No bone node mapping');
      nodeBones.set(node, o);
      if (/(?:Left|Right)(?:Arm|ForeArm|Hand)$/.test(o.name))
        json.nodes[node].translation = o.position.toArray();
    });
    for (const skin of json.skins)
      writeFloats(
        skin.inverseBindMatrices,
        skin.joints.flatMap((node: number) => nodeBones.get(node)!.matrixWorld.clone().invert().toArray()),
        16,
      );
    for (const animation of json.animations)
      for (const channel of animation.channels) {
        const bone = nodeBones.get(channel.target.node);
        if (
          channel.target.path !== 'translation' ||
          !bone ||
          !/(?:Left|Right)(?:Arm|ForeArm|Hand)$/.test(bone.name)
        )
          continue;
        const accessor = animation.samplers[channel.sampler].output,
          count = json.accessors[accessor].count;
        writeFloats(accessor, Array.from({ length: count }, () => bone.position.toArray()).flat(), 3);
      }
  }
  // Repack JSON only when authored joint translations changed. Binary image,
  // geometry and rotation-track payloads remain untouched.
  let resultBytes = bytes;
  if (refitted || ambonaPose || smoothCandidate) {
    const document = Buffer.from(JSON.stringify(json)),
      padded = Buffer.alloc(Math.ceil(document.length / 4) * 4, 32);
    document.copy(padded);
    const binary = bytes.subarray(binaryStart),
      header = Buffer.alloc(20),
      binHeader = Buffer.alloc(8);
    header.writeUInt32LE(0x46546c67, 0);
    header.writeUInt32LE(2, 4);
    header.writeUInt32LE(28 + padded.length + binary.length, 8);
    header.writeUInt32LE(padded.length, 12);
    header.writeUInt32LE(0x4e4f534a, 16);
    binHeader.writeUInt32LE(binary.length, 0);
    binHeader.writeUInt32LE(0x004e4942, 4);
    resultBytes = Buffer.concat([header, padded, binHeader, binary]);
  }
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, resultBytes);
  if (install) copyFileSync(output, target);
  results.push({ path, patched, refitted, sha256: createHash('sha256').update(resultBytes).digest('hex') });
  writeFileSync(`${report}/report.json`, JSON.stringify({ install, results }, null, 2));
  console.log(`${results.length}/${paths.length} ${path}`);
}
