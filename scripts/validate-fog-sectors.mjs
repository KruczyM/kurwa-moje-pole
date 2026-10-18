import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const directory = new URL('../public/game-assets/world/festival/', import.meta.url);
const hash = (data) => createHash('sha256').update(data).digest('hex');
function glb(url) {
  const raw = readFileSync(url);
  assert.equal(raw.readUInt32LE(0), 0x46546c67, `Not a GLB: ${url}`);
  const size = raw.readUInt32LE(12);
  return { raw, doc: JSON.parse(raw.subarray(20, 20 + size)), binary: raw.subarray(28 + size) };
}
function viewBytes(asset, view) {
  const offset = view.byteOffset ?? 0;
  return asset.binary.subarray(offset, offset + view.byteLength);
}
const source = glb(new URL('authored-festival.glb', directory));
const manifest = JSON.parse(readFileSync(new URL('fog-trial/manifest.json', directory), 'utf8'));
assert.equal(
  manifest.sourceSha256,
  hash(source.raw),
  'Rebuild fog sectors after changing the Blender export',
);
assert.equal(manifest.schema, 1);
const base = glb(new URL('fog-trial/base.glb', directory));
assert.equal(base.doc.nodes.length, source.doc.nodes.length);
const expected = new Set(),
  actual = new Set();
function verify(asset, isBase) {
  for (const view of asset.doc.bufferViews) {
    if (view.extras?.fogSourceView === undefined) continue;
    assert.equal(
      hash(viewBytes(asset, view)),
      hash(viewBytes(source, source.doc.bufferViews[view.extras.fogSourceView])),
      'Geometry changed',
    );
  }
  for (const image of asset.doc.images) {
    const index = Number(image.extras.fogImageKey.split(':').at(-1));
    const blob = readFileSync(
      new URL(image.uri, new URL(isBase ? 'fog-trial/base.glb' : 'fog-trial/sectors/sector.glb', directory)),
    );
    assert.equal(
      hash(blob),
      hash(viewBytes(source, source.doc.bufferViews[source.doc.images[index].bufferView])),
      'Texture changed',
    );
  }
  for (const node of asset.doc.nodes) {
    const index = node.extras.fogSourceNode,
      original = source.doc.nodes[index];
    for (const key of ['matrix', 'translation', 'rotation', 'scale', 'name'])
      assert.deepEqual(node[key], original[key], `Transform changed: ${index}/${key}`);
    for (const [key, value] of Object.entries(original.extras ?? {}))
      assert.deepEqual(node.extras[key], value);
    if (node.mesh === undefined) continue;
    if (isBase && node.extras.fogProxy) {
      expected.add(index);
      const positions = source.doc.meshes[original.mesh].primitives.map(
        (p) => source.doc.accessors[p.attributes.POSITION],
      );
      const position = asset.doc.accessors[asset.doc.meshes[node.mesh].primitives[0].attributes.POSITION];
      assert.deepEqual(
        position.min,
        [0, 1, 2].map((j) => Math.min(...positions.map((a) => a.min[j]))),
      );
      assert.deepEqual(
        position.max,
        [0, 1, 2].map((j) => Math.max(...positions.map((a) => a.max[j]))),
      );
    } else if (!isBase) {
      assert(!actual.has(index), `Duplicate static node ${index}`);
      actual.add(index);
    }
  }
}
verify(base, true);
for (const sector of manifest.sectors) {
  const asset = glb(new URL(`fog-trial/${sector.path}`, directory));
  assert.equal(asset.raw.length, sector.bytes);
  verify(asset, false);
}
assert.deepEqual(actual, expected, 'Missing/extra static meshes');
console.log(
  `Fog sectors validated: ${manifest.sectors.length} sectors, ${actual.size} meshes, original transforms/geometry/images/bounds preserved.`,
);

// Mobile exports are another complete partition of the same static meshes, grouped by place.
const mobile = JSON.parse(readFileSync(new URL('fog-trial/mobile-manifest.json', directory), 'utf8'));
const areas = JSON.parse(
  readFileSync(new URL('../src/game/world/mobileFestivalAreas.json', import.meta.url), 'utf8'),
);
assert.equal(mobile.sourceSha256, manifest.sourceSha256);
assert.deepEqual(mobile.areas, areas.areas, 'Rebuild mobile sectors after changing area definitions');
actual.clear();
const parents = new Map();
source.doc.nodes.forEach((node, i) => node.children?.forEach((child) => parents.set(child, i)));
const placementAreas = new Map();
for (const sector of mobile.sectors) {
  assert(
    areas.areas.some((area) => area.id === sector.area),
    'Unknown mobile area',
  );
  const asset = glb(new URL(`fog-trial/${sector.path}`, directory));
  assert.equal(asset.raw.length, sector.bytes);
  verify(asset, false);
  for (const node of asset.doc.nodes) {
    if (node.mesh === undefined) continue;
    let owner = node.extras.fogSourceNode;
    while (!source.doc.nodes[owner].extras?.runtimePlacement && parents.has(owner))
      owner = parents.get(owner);
    if (placementAreas.has(owner))
      assert.equal(placementAreas.get(owner), sector.area, 'Placement split between mobile areas');
    placementAreas.set(owner, sector.area);
  }
}
assert.deepEqual(actual, expected, 'Missing/extra mobile static meshes');
assert.equal(new Set(mobile.sectors.map((sector) => sector.area)).size, areas.areas.length);
console.log(
  `Mobile areas validated: ${areas.areas.length} places, ${mobile.sectors.length} chunks, ${actual.size} meshes; complete placements preserved.`,
);

const asp = source.doc.nodes.findIndex((node) => node.extras?.runtimePlacement === 'smallStage');
assert(asp >= 0, 'ASP placement missing from authored world');
assert.equal(placementAreas.get(asp), 'south-passage', 'ASP missing or assigned to wrong mobile area');
const aspMeshes = [...expected].filter((index) => {
  let owner = index;
  while (!source.doc.nodes[owner].extras?.runtimePlacement && parents.has(owner)) owner = parents.get(owner);
  return owner === asp;
});
assert(aspMeshes.length > 0, 'ASP has no streamed geometry');
const aspCanopy = aspMeshes.find(
  (index) => source.doc.nodes[index].extras?.runtimeNode === 'ASP_Tent_Canopy',
);
assert(aspCanopy !== undefined, 'ASP canopy missing from mobile export');
console.log(`ASP validated: ${aspMeshes.length} meshes in south-passage, including canopy.`);

const layout = JSON.parse(readFileSync(new URL('map-layout.json', directory), 'utf8'));
const aspMap = layout.scenery.find((item) => item.id === 'smallStage');
assert(aspMap, 'ASP footprint missing from map');
const aspArea = areas.areas.find((area) => area.id === 'south-passage');
assert(aspArea.label.includes('ASP'));
for (const x of [aspMap.x - aspMap.width / 2, aspMap.x + aspMap.width / 2]) {
  for (const z of [aspMap.z - aspMap.depth / 2, aspMap.z + aspMap.depth / 2]) {
    assert(
      aspArea.regions.some(([x1, x2, z1, z2]) => x >= x1 && x < x2 && z >= z1 && z < z2),
      'ASP footprint crosses a mobile boundary',
    );
  }
}

const screenIds = new Set(['Wing_Single_Telebim_Left', 'Wing_Single_Telebim_Right']);
const residentScreens = base.doc.nodes.filter((node) =>
  screenIds.has(node.extras?.runtimeNode ?? node.extras?.runtimePlacement ?? node.name),
);
assert.equal(residentScreens.length, 2, 'Both mobile telebim screens must be resident');
for (const screen of residentScreens) {
  assert(
    screen.mesh !== undefined && !screen.extras.fogProxy,
    'Live screen was replaced by an invisible collision proxy',
  );
  assert(!expected.has(screen.extras.fogSourceNode), 'Live screen must not be unloaded as static scenery');
}
console.log('Mobile telebims validated: 2 real resident screens, no static proxy replacement.');
