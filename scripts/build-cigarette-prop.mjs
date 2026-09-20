// Run with: node --import tsx scripts/build-cigarette-prop.mjs
// Geometry/material source is shared with the runtime's missing-asset fallback.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { createUsePropFallback } from '../src/game/interactions/itemUseProp.ts';
import { disposeObjectTree } from '../src/game/lifecycle/disposeThree.ts';

// GLTFExporter only needs this browser API for Blob -> binary conversion.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = result;
      this.onloadend?.();
    });
  }
};

/** Small deterministic paper grain, encoded as PNG without browser canvas or dependencies. */
function paperTexture() {
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    let crc = 0xffffffff;
    for (const byte of body) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    const result = Buffer.alloc(body.length + 8);
    result.writeUInt32BE(data.length, 0);
    body.copy(result, 4);
    result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, result.length - 4);
    return result;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(32, 0);
  header.writeUInt32BE(32, 4);
  header[8] = 8;
  header[9] = 2; // RGB, 8 bits per channel.
  const pixels = Buffer.alloc(32 * (1 + 32 * 3));
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const shade = 240 + ((x * 73 + y * 151 + x * y * 13) % 16);
      pixels.fill(shade, y * 97 + 1 + x * 3, y * 97 + 4 + x * 3);
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Embed the generated grain in the GLB so it follows the project's textured PBR contract. */
function withPaperTexture(arrayBuffer) {
  const source = Buffer.from(arrayBuffer);
  const jsonLength = source.readUInt32LE(12);
  const json = JSON.parse(source.toString('utf8', 20, 20 + jsonLength));
  const originalBinary = source.subarray(28 + jsonLength);
  const texture = paperTexture();
  const binary = Buffer.concat([originalBinary, texture, Buffer.alloc((4 - (texture.length % 4)) % 4)]);
  const view = json.bufferViews.length;
  json.bufferViews.push({ buffer: 0, byteOffset: originalBinary.length, byteLength: texture.length });
  json.images = [{ name: 'ProceduralPaperGrain', mimeType: 'image/png', bufferView: view }];
  json.textures = [{ source: 0 }];
  for (const material of json.materials) material.pbrMetallicRoughness.baseColorTexture = { index: 0 };
  json.buffers[0].byteLength = binary.length;
  const jsonBytes = Buffer.from(JSON.stringify(json));
  const paddedJson = Buffer.concat([jsonBytes, Buffer.alloc((4 - (jsonBytes.length % 4)) % 4, 0x20)]);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + paddedJson.length + binary.length, 8);
  header.writeUInt32LE(paddedJson.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binary.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, paddedJson, binHeader, binary]);
}

const model = createUsePropFallback('Papieros');
model.name = 'Cigarette';
model.rotation.set(0, 0, 0);
model.scale.setScalar(0.12);
try {
  const glb = await new GLTFExporter().parseAsync(model, { binary: true });
  const target = new URL('../public/game-assets/interactables/cigarette.glb', import.meta.url);
  const textured = withPaperTexture(glb);
  writeFileSync(target, textured);
  console.log(`Built cigarette.glb (${textured.length} bytes)`);
} finally {
  disposeObjectTree(model);
}
