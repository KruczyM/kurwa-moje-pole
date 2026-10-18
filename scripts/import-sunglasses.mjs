// CC0 model by iPoly3D: https://poly.pizza/m/9xOJlCsQzX
// Asset generation only: preserve geometry, darken the original frame and lenses.
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const response = await fetch('https://static.poly.pizza/403dfb59-d182-43cb-9a39-8d2850f27ce7.glb');
assert(response.ok, `Download failed: ${response.status}`);
const original = Buffer.from(await response.arrayBuffer());
assert.equal(original.readUInt32LE(0), 0x46546c67);
const length = original.readUInt32LE(12);
const gltf = JSON.parse(original.subarray(20, 20 + length));
assert.equal(gltf.materials.length, 2);
for (const material of gltf.materials) {
  const lens = material.name === 'Material.032';
  assert(lens || material.name === 'Material.033', 'Source model changed; review materials');
  material.pbrMetallicRoughness = {
    baseColorFactor: lens ? [0.03, 0.07, 0.1, 1] : [0.055, 0.06, 0.07, 1],
    metallicFactor: lens ? 0.15 : 0,
    roughnessFactor: lens ? 0.18 : 0.35,
  };
}
gltf.asset.extras = {
  source: 'https://poly.pizza/m/9xOJlCsQzX',
  author: 'iPoly3D',
  license: 'CC0-1.0',
  changes: 'Dark frame and lenses; geometry unchanged',
};
const json = Buffer.from(JSON.stringify(gltf));
const padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 0x20);
json.copy(padded);
const tail = original.subarray(20 + length);
const header = Buffer.alloc(20);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(20 + padded.length + tail.length, 8);
header.writeUInt32LE(padded.length, 12);
header.writeUInt32LE(0x4e4f534a, 16);
const output = Buffer.concat([header, padded, tail]);
await writeFile(new URL('../public/game-assets/interactables/sunglasses.glb', import.meta.url), output);
console.log(`Imported CC0 sunglasses: ${output.length} bytes, no external textures.`);
