import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Read-only inventory of generated characters; never treats a static GLB as an animated NPC. */
export function inspectNpcGlb(buffer) {
  if (
    buffer.length < 20 ||
    buffer.readUInt32LE(0) !== 0x46546c67 ||
    buffer.readUInt32LE(4) !== 2 ||
    buffer.readUInt32LE(8) !== buffer.length ||
    buffer.readUInt32LE(16) !== 0x4e4f534a
  )
    throw new Error('Invalid GLB 2.0 header');
  const end = 20 + buffer.readUInt32LE(12);
  if (end > buffer.length) throw new Error('Truncated GLB JSON');
  const gltf = JSON.parse(buffer.subarray(20, end).toString('utf8').trim());
  const primitives = (gltf.meshes ?? []).flatMap((mesh) => mesh.primitives ?? []);
  const skinCount = (gltf.skins ?? []).length;
  const weightedPrimitives = primitives.filter(
    (primitive) =>
      primitive.attributes?.JOINTS_0 !== undefined && primitive.attributes?.WEIGHTS_0 !== undefined,
  ).length;
  const skinnedNodes = (gltf.nodes ?? []).filter(
    (node) => node.mesh !== undefined && node.skin !== undefined && gltf.skins?.[node.skin]?.joints?.length,
  ).length;
  const clips = (gltf.animations ?? []).map((animation) => animation.name ?? '(unnamed)');
  const rigged = skinCount > 0 && weightedPrimitives > 0 && skinnedNodes > 0;
  return {
    bytes: buffer.length,
    sha256: createHash('sha256').update(buffer).digest('hex'),
    meshes: (gltf.meshes ?? []).length,
    triangles: primitives.reduce((sum, primitive) => {
      if ((primitive.mode ?? 4) !== 4) return sum;
      const accessor = gltf.accessors?.[primitive.indices ?? primitive.attributes?.POSITION];
      return sum + (accessor?.count ?? 0) / 3;
    }, 0),
    images: (gltf.images ?? []).length,
    skinCount,
    weightedPrimitives,
    skinnedNodes,
    clips,
    status: !rigged ? 'RIGGING_REQUIRED' : clips.length ? 'ANIMATION_REVIEW_REQUIRED' : 'ANIMATIONS_REQUIRED',
  };
}

export function auditNpcSource(source) {
  const entries = readdirSync(source, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{3}_/.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => {
      const file = ['textured.glb', 'shape.glb'].find((candidate) =>
        existsSync(join(source, entry.name, candidate)),
      );
      if (!file) return { id: entry.name, status: 'MODEL_MISSING' };
      try {
        return { id: entry.name, file, ...inspectNpcGlb(readFileSync(join(source, entry.name, file))) };
      } catch (error) {
        return { id: entry.name, file, status: 'INVALID_MODEL', error: error.message };
      }
    });
  return {
    source: resolve(source),
    summary: {
      folders: entries.length,
      models: entries.filter((entry) => entry.sha256).length,
      bytes: entries.reduce((sum, entry) => sum + (entry.bytes ?? 0), 0),
      triangles: entries.reduce((sum, entry) => sum + (entry.triangles ?? 0), 0),
      riggingRequired: entries.filter((entry) => entry.status === 'RIGGING_REQUIRED').length,
      missing: entries.filter((entry) => entry.status === 'MODEL_MISSING').map((entry) => entry.id),
      invalid: entries.filter((entry) => entry.status === 'INVALID_MODEL').map((entry) => entry.id),
    },
    entries,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const source = process.argv[2];
  if (!source) throw new Error('Usage: node scripts/audit-npc-source.mjs <source-directory>');
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const output = join(root, 'reports/npc-source-audit.json');
  const report = auditNpcSource(source);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ report: output, ...report.summary }, null, 2));
}
