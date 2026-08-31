import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Tworzy kopię GLB bez klipów animacji. Skrypt zachowuje siatkę, rig,
 * materiały, tekstury i pozostałe binarne chunki pliku źródłowego.
 */

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [, , inputArgument, outputArgument] = process.argv;

if (!inputArgument || !outputArgument) {
  console.error('Użycie: node scripts/strip-glb-animations.mjs INPUT.glb OUTPUT.glb');
  process.exit(2);
}

const inputPath = resolve(root, inputArgument);
const outputPath = resolve(root, outputArgument);
const source = readFileSync(inputPath);
if (source.readUInt32LE(0) !== GLB_MAGIC || source.readUInt32LE(4) !== 2) {
  throw new Error('Wejście nie jest plikiem GLB 2.0.');
}

const chunks = [];
let json;
for (let offset = 12; offset < source.length;) {
  const length = source.readUInt32LE(offset);
  const type = source.readUInt32LE(offset + 4);
  const data = source.subarray(offset + 8, offset + 8 + length);
  if (type === JSON_CHUNK) {
    json = JSON.parse(data.toString('utf8').replace(/[\u0000\u0020]+$/u, ''));
  } else chunks.push({ type, data });
  offset += 8 + length;
}
if (!json) throw new Error('GLB nie zawiera chunka JSON.');

const removed = json.animations?.length ?? 0;
delete json.animations;
const rawJson = Buffer.from(JSON.stringify(json), 'utf8');
const jsonPadding = (4 - (rawJson.length % 4)) % 4;
const jsonData = Buffer.concat([rawJson, Buffer.alloc(jsonPadding, 0x20)]);
const totalLength = 12 + 8 + jsonData.length + chunks.reduce((sum, chunk) => sum + 8 + chunk.data.length, 0);
const output = Buffer.alloc(totalLength);
output.writeUInt32LE(GLB_MAGIC, 0);
output.writeUInt32LE(2, 4);
output.writeUInt32LE(totalLength, 8);
let outputOffset = 12;
for (const chunk of [{ type: JSON_CHUNK, data: jsonData }, ...chunks]) {
  output.writeUInt32LE(chunk.data.length, outputOffset);
  output.writeUInt32LE(chunk.type, outputOffset + 4);
  chunk.data.copy(output, outputOffset + 8);
  outputOffset += 8 + chunk.data.length;
}
writeFileSync(outputPath, output);
console.log(`Zapisano ${outputPath}; usunięto klipy: ${removed}.`);
