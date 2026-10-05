import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const bytes = readFileSync(
  new URL('../public/game-assets/world/festival/authored-festival.glb', import.meta.url),
);
assert.equal(bytes.readUInt32LE(0), 0x46546c67);
assert.equal(bytes.readUInt32LE(8), bytes.length);
const data = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
const placements = data.nodes.filter((n) => n.extras?.runtimePlacement);
assert.equal(new Set(placements.map((n) => n.extras.runtimePlacement)).size, placements.length);
for (const id of ['MadDog', 'mainStage', 'smallStage', 'AllegroWheel', 'CampToilet', 'S01'])
  assert.ok(
    placements.some((n) => n.extras.runtimePlacement === id),
    `Missing ${id}`,
  );
assert.equal(data.nodes.filter((n) => n.extras?.wheelPart === 'gondola').length, 24);
assert.equal(placements.filter((n) => n.extras.runtimePlacement.startsWith('StageBarrier_')).length, 48);
const photoFlags = placements.filter((n) => Number.isInteger(n.extras.campFlagDesign));
assert.equal(photoFlags.length, 40);
assert.equal(new Set(photoFlags.map((n) => n.extras.campFlagDesign)).size, 40);
assert.equal(placements.filter((n) => n.extras.campFlagPole).length, 40);
assert.equal(placements.filter((n) => n.extras.replace_with_photo).length, 0);
function validateMetadata(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    assert.ok(!/blenderkit|api_key|access_token/i.test(key), 'Addon/account metadata must not be exported');
    validateMetadata(child);
  }
}
validateMetadata(data);
for (const name of ['Passage_Gray_Concrete', 'Camp_Worn_Grass']) {
  const material = data.materials.find((m) => m.name === name);
  assert.ok(material?.pbrMetallicRoughness?.baseColorTexture, `Missing texture: ${name}`);
  assert.ok(material?.pbrMetallicRoughness?.baseColorFactor, `Missing tint: ${name}`);
  assert.ok(material?.normalTexture, `Missing normal map: ${name}`);
}
const source = readFileSync(new URL('../blender/festival-layout.blend', import.meta.url));
const report = JSON.parse(
  readFileSync(new URL('../reports/festival-blender/runtime-export.json', import.meta.url), 'utf8'),
);
assert.equal(createHash('sha256').update(source).digest('hex'), report.sourceSha256, 'Export is stale');
console.log(
  JSON.stringify({ passed: true, placements: placements.length, bytes: bytes.length, sourceUnchanged: true }),
);
