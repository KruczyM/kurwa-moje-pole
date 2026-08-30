import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(readFileSync(join(root, 'src/game/assets/assetCatalog.json'), 'utf8'));
const contract = JSON.parse(readFileSync(join(root, 'src/game/animation/characterAnimationContract.json'), 'utf8'));
const approvals = JSON.parse(readFileSync(join(root, 'src/game/animation/characterRigApproval.json'), 'utf8'));
const reportPath = join(root, 'reports', 'character-rig-validation.json');
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function parseGlb(path) {
  const file = readFileSync(path);
  if (file.length < 20 || file.readUInt32LE(0) !== 0x46546c67 || file.readUInt32LE(4) !== 2) {
    throw new Error('nieprawidłowy plik GLB 2.0');
  }
  let json;
  let binary;
  for (let offset = 12; offset < file.length;) {
    const length = file.readUInt32LE(offset);
    const type = file.readUInt32LE(offset + 4);
    const data = file.subarray(offset + 8, offset + 8 + length);
    if (type === JSON_CHUNK) json = JSON.parse(data.toString('utf8').replace(/[\u0000\u0020]+$/u, ''));
    if (type === BIN_CHUNK) binary = data;
    offset += 8 + length;
  }
  if (!json || !binary) throw new Error('GLB nie zawiera JSON lub bufora binarnego');
  return { json, binary };
}

function jointNames(gltf) {
  return [...new Set(
    (gltf.skins ?? [])
      .flatMap((skin) => skin.joints ?? [])
      .map((index) => gltf.nodes?.[index]?.name)
      .filter(Boolean),
  )].sort();
}

function embeddedImageHashes(parsed) {
  return (parsed.json.images ?? []).map((image) => {
    if (!Number.isInteger(image.bufferView)) return image.uri ? hash(image.uri) : 'missing';
    const view = parsed.json.bufferViews?.[image.bufferView];
    if (!view || view.buffer !== 0) return 'missing';
    const start = view.byteOffset ?? 0;
    return hash(parsed.binary.subarray(start, start + view.byteLength));
  });
}

function structuralHash(value) {
  return hash(JSON.stringify(value ?? []));
}

function validateCharacter(character) {
  const problems = [];
  const runtimePath = join(root, 'public', 'game-assets', 'characters', character.id, 'npc-animations.glb');
  const sourcePath = join(root, 'source-assets', 'characters', character.id, 't-pose.glb');
  if (!existsSync(runtimePath)) problems.push({ level: 'error', code: 'missing-runtime', message: runtimePath });
  if (!existsSync(sourcePath)) problems.push({ level: 'error', code: 'missing-t-pose', message: sourcePath });
  if (problems.length) return { id: character.id, name: character.name, status: 'error', problems };

  let runtime;
  let source;
  try {
    runtime = parseGlb(runtimePath);
    source = parseGlb(sourcePath);
  } catch (error) {
    problems.push({ level: 'error', code: 'invalid-glb', message: error instanceof Error ? error.message : String(error) });
    return { id: character.id, name: character.name, status: 'error', problems };
  }

  const runtimeBones = jointNames(runtime.json);
  const sourceBones = jointNames(source.json);
  const requiredBones = Object.values(contract.rig.requiredBones);
  const missingCoreBones = requiredBones.filter((bone) => !runtimeBones.includes(bone));
  if (missingCoreBones.length) {
    problems.push({ level: 'error', code: 'missing-core-bones', message: missingCoreBones.join(', ') });
  }
  const missingInSource = runtimeBones.filter((bone) => !sourceBones.includes(bone));
  const additionalInSource = sourceBones.filter((bone) => !runtimeBones.includes(bone));
  if (missingInSource.length || additionalInSource.length) {
    problems.push({
      level: 'error',
      code: 'skeleton-mismatch',
      message: `brak w T-pose: ${missingInSource.join(', ') || '—'}; dodatkowe: ${additionalInSource.join(', ') || '—'}`,
    });
  }

  const expectedClips = Object.values(contract.clips).sort();
  const actualClips = (runtime.json.animations ?? []).map((animation) => animation.name).filter(Boolean).sort();
  const missingClips = expectedClips.filter((clip) => !actualClips.includes(clip));
  const additionalClips = actualClips.filter((clip) => !expectedClips.includes(clip));
  if (missingClips.length || additionalClips.length) {
    problems.push({
      level: 'error',
      code: 'clip-contract-mismatch',
      message: `brak: ${missingClips.join(', ') || '—'}; dodatkowe: ${additionalClips.join(', ') || '—'}`,
    });
  }
  if ((source.json.animations ?? []).length) {
    problems.push({ level: 'error', code: 'animated-t-pose', message: 'źródło T-pose nie może zawierać klipów' });
  }

  const runtimeImages = embeddedImageHashes(runtime);
  const sourceImages = embeddedImageHashes(source);
  if (JSON.stringify(runtimeImages) !== JSON.stringify(sourceImages)) {
    problems.push({ level: 'error', code: 'texture-mismatch', message: 'tekstury T-pose i paczki NPC nie są identyczne' });
  }
  if (structuralHash(runtime.json.meshes) !== structuralHash(source.json.meshes)) {
    problems.push({ level: 'error', code: 'mesh-mismatch', message: 'definicja siatki T-pose i paczki NPC nie jest identyczna' });
  }
  if (structuralHash(runtime.json.materials) !== structuralHash(source.json.materials)) {
    problems.push({ level: 'error', code: 'material-mismatch', message: 'materiały T-pose i paczki NPC nie są identyczne' });
  }

  const approval = approvals[character.id];
  if (approval?.status === 'pending') {
    problems.push({ level: 'blocker', code: 'visual-approval-pending', message: approval.reason });
  }
  const status = problems.some((problem) => problem.level === 'error')
    ? 'error'
    : problems.some((problem) => problem.level === 'blocker')
      ? 'blocked'
      : 'ok';
  return {
    id: character.id,
    name: character.name,
    status,
    rig: contract.rig.name,
    joints: runtimeBones.length,
    clips: actualClips,
    meshHash: structuralHash(runtime.json.meshes),
    materialHash: structuralHash(runtime.json.materials),
    textureHashes: runtimeImages,
    problems,
  };
}

const characters = catalog.characters.map(validateCharacter);
const summary = {
  total: characters.length,
  ok: characters.filter((character) => character.status === 'ok').length,
  blockers: characters.filter((character) => character.status === 'blocked').length,
  errors: characters.filter((character) => character.status === 'error').length,
};
mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), summary, characters }, null, 2)}\n`);

for (const character of characters) {
  const marker = character.status === 'ok' ? 'OK' : character.status === 'blocked' ? 'BLOKER' : 'BLAD';
  console.log(`[${marker}] ${character.name}: ${character.joints ?? 0} kości, ${character.clips?.length ?? 0} klipów`);
  character.problems.forEach((problem) => console.log(`  - ${problem.level}: ${problem.code} — ${problem.message}`));
}
console.log(`\nRaport: ${reportPath}`);
console.log(`Podsumowanie: ${summary.ok} OK, ${summary.blockers} blockerów, ${summary.errors} błędów.`);
if (summary.errors) process.exit(1);
