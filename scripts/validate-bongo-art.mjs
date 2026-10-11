import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, 'public/game-assets/2d/bongo-rush/characters');

/** Rejects missing atlas frames, accidental T-pose sources, ambiguous rows and malformed PNG dimensions. */
function validateAtlas(name) {
  const meta = JSON.parse(fs.readFileSync(path.join(directory, name, 'meta.json'), 'utf8'));
  const png = fs.readFileSync(path.join(directory, name, 'spritesheet.png'));
  assert.equal(png.readUInt32BE(0), 0x89504e47, `${name}: invalid PNG`);
  assert.equal(png.readUInt32BE(16), meta.frameWidth * meta.framesPerDirection);
  assert.equal(png.readUInt32BE(20), meta.frameHeight * 4);
  assert.deepEqual(meta.rows, { down: 0, right: 1, up: 2, left: 3 });
  assert.equal(meta.cameraFit, 'all-evaluated-frames-sphere');
  if (!['patrol', 'owsiak'].includes(name)) {
    assert.equal(meta.framesPerDirection, 5);
    assert.deepEqual(meta.animationColumns, { idle: [0], walk: [1, 2, 3, 4] });
    assert.ok(meta.source.endsWith('/npc-animations.glb'));
  }
}

/** Confirms real embedded textured geometry, while making the absence of a production rig explicit. */
function validateModel(name) {
  const file = fs.readFileSync(path.join(root, `source-assets/bongo-rush/models/${name}-textured.glb`));
  assert.equal(file.toString('ascii', 0, 4), 'glTF');
  assert.equal(file.readUInt32LE(4), 2);
  assert.equal(file.readUInt32LE(8), file.length);
  const json = JSON.parse(file.toString('utf8', 20, 20 + file.readUInt32LE(12)));
  assert.ok(json.meshes?.length && json.images?.length && json.textures?.length);
  assert.ok(json.images.every((image) => image.bufferView !== undefined && !image.uri));
  assert.ok(json.materials.some((material) => material.pbrMetallicRoughness?.baseColorTexture));
  assert.ok(
    json.meshes.some((mesh) =>
      mesh.primitives.some((primitive) => json.accessors[primitive.attributes.POSITION].count > 1000),
    ),
  );
  console.log(`${name}: textured embedded geometry; rig=${Boolean(json.skins?.length)}`);
}

const names = fs
  .readdirSync(directory)
  .filter((name) => fs.statSync(path.join(directory, name)).isDirectory());
assert.equal(names.length, 18);
for (const name of names) validateAtlas(name);
for (const name of ['owsiak', 'patrol']) validateModel(name);
console.log(`Bongo artwork valid: ${names.length} atlases and 2 textured models`);
