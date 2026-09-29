import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const report = resolve(process.argv[2] ?? 'reports/skin-weight-repair-20260926');
const { results } = JSON.parse(readFileSync(`${report}/report.json`));
for (const { path } of results) {
  const original = readFileSync(`${report}/originals/${path}`);
  const current = readFileSync(`public/game-assets/${path}`);
  if (original.length !== current.length) throw new Error(`Container changed: ${path}`);
  const length = original.readUInt32LE(12),
    binary = 20 + length + 8;
  const json = JSON.parse(original.subarray(20, 20 + length));
  const permitted = new Uint8Array(original.length);
  for (const mesh of json.meshes)
    for (const primitive of mesh.primitives)
      for (const semantic of ['JOINTS_0', 'WEIGHTS_0']) {
        const a = json.accessors[primitive.attributes[semantic]],
          v = json.bufferViews[a.bufferView];
        const size = a.componentType === 5126 ? 4 : a.componentType === 5123 ? 2 : 1;
        for (let i = 0; i < a.count; i++) {
          const offset = binary + (v.byteOffset ?? 0) + (a.byteOffset ?? 0) + i * (v.byteStride ?? size * 4);
          permitted.fill(1, offset, offset + size * 4);
        }
      }
  for (let i = 0; i < original.length; i++)
    if (!permitted[i] && original[i] !== current[i]) throw new Error(`Non-weight byte changed ${path}:${i}`);
}
console.log(
  `${results.length} assets: only skin weights/joint indices changed; geometry, UV, textures, bones and animations preserved.`,
);
