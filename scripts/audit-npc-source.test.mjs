import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inspectNpcGlb } from './audit-npc-source.mjs';

function glb(json) {
  const text = JSON.stringify(json);
  const data = Buffer.from(text.padEnd(Math.ceil(text.length / 4) * 4, ' '));
  const buffer = Buffer.alloc(20 + data.length);
  buffer.writeUInt32LE(0x46546c67, 0);
  buffer.writeUInt32LE(2, 4);
  buffer.writeUInt32LE(buffer.length, 8);
  buffer.writeUInt32LE(data.length, 12);
  buffer.writeUInt32LE(0x4e4f534a, 16);
  data.copy(buffer, 20);
  return buffer;
}

test('static geometry with transform animation still needs rigging', () => {
  const result = inspectNpcGlb(glb({ animations: [{ name: 'Walk' }] }));
  assert.equal(result.status, 'RIGGING_REQUIRED');
  assert.equal(result.skinCount, 0);
});

test('skin declarations without bound weighted meshes are not enough', () => {
  const result = inspectNpcGlb(glb({ skins: [{ joints: [0] }], animations: [{ name: 'Walk' }] }));
  assert.equal(result.status, 'RIGGING_REQUIRED');
});

test('a bound rig still requires animation review and does not automatically pass visual QA', () => {
  const result = inspectNpcGlb(
    glb({
      meshes: [{ primitives: [{ attributes: { POSITION: 0, JOINTS_0: 1, WEIGHTS_0: 2 } }] }],
      nodes: [{ mesh: 0, skin: 0 }],
      skins: [{ joints: [1] }],
      animations: [{ name: 'Idle' }, { name: 'Walk' }, { name: 'Run' }],
      accessors: [{ count: 36 }],
    }),
  );
  assert.equal(result.status, 'ANIMATION_REVIEW_REQUIRED');
  assert.equal(result.triangles, 12);
});

test('rejects malformed and truncated GLBs', () => {
  assert.throws(() => inspectNpcGlb(Buffer.alloc(12)), /Invalid/);
  const buffer = glb({});
  buffer.writeUInt32LE(1000, 12);
  assert.throws(() => inspectNpcGlb(buffer), /Truncated/);
});
