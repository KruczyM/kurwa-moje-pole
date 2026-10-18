import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
const report = process.argv[2] ?? 'reports/shoulder-rig-repair-20260926';
const unpack = (b) => {
  const n = b.readUInt32LE(12);
  return { json: JSON.parse(b.subarray(20, 20 + n)), bin: b.subarray(28 + n) };
};
for (const { path } of JSON.parse(readFileSync(`${report}/report.json`)).results) {
  const original = unpack(readFileSync(`${report}/originals/${path}`)),
    result = unpack(readFileSync(`public/game-assets/${path}`));
  const j = original.json,
    current = result.json,
    allowed = new Set();
  for (const mesh of j.meshes)
    for (const p of mesh.primitives)
      for (const key of ['JOINTS_0', 'WEIGHTS_0']) allowed.add(p.attributes[key]);
  for (const skin of j.skins) allowed.add(skin.inverseBindMatrices);
  const changedJoint = (node) => /(?:Left|Right)(?:Arm|ForeArm|Hand)$/.test(j.nodes[node].name ?? '');
  for (let i = 0; i < j.nodes.length; i++)
    if (changedJoint(i)) j.nodes[i].translation = current.nodes[i].translation;
  for (const animation of j.animations)
    for (const channel of animation.channels)
      if (channel.target.path === 'translation' && changedJoint(channel.target.node))
        allowed.add(animation.samplers[channel.sampler].output);
  const mask = new Uint8Array(original.bin.length);
  for (const id of allowed) {
    const a = j.accessors[id],
      view = j.bufferViews[a.bufferView],
      size = a.componentType === 5126 ? 4 : a.componentType === 5123 ? 2 : 1,
      width = a.type === 'MAT4' ? 16 : a.type === 'VEC3' ? 3 : 4;
    for (let i = 0; i < a.count; i++) {
      const offset = (view.byteOffset ?? 0) + (a.byteOffset ?? 0) + i * (view.byteStride ?? size * width);
      mask.fill(1, offset, offset + size * width);
    }
    if (a.min) a.min = current.accessors[id].min;
    if (a.max) a.max = current.accessors[id].max;
  }
  if (!isDeepStrictEqual(j, current)) throw new Error(`Unexpected document change: ${path}`);
  if (original.bin.length !== result.bin.length) throw new Error(`Binary resized: ${path}`);
  for (let i = 0; i < mask.length; i++)
    if (!mask[i] && original.bin[i] !== result.bin[i])
      throw new Error(`Unexpected payload change: ${path}:${i}`);
  console.log(`${path}: geometry, textures, rotation clips preserved; only shoulder rig/skin updated`);
}
