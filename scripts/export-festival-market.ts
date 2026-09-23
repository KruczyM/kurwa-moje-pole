/** Offline QA only: exports transforms/road geometry from the actual world placement code. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import catalog from '../src/game/assets/assetCatalog.json';
import { marketLaneMaterial, marketTemplates, placeFestivalMarket } from '../src/game/world/festivalMarket';
import { terrainHeight } from '../src/game/world/terrainHeight';
import { disposeObjectTree } from '../src/game/lifecycle/disposeThree';

async function main() {
  const loader = new GLTFLoader();
  loader.register(() => ({
    name: 'offline-images',
    loadTexture: () => Promise.resolve(new THREE.Texture()),
  }));
  const bytes = readFileSync(`public/game-assets/${catalog.environment.marketStalls}`);
  const source = await loader.parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  const parent = new THREE.Group();
  placeFestivalMarket(parent, marketTemplates(source), terrainHeight, marketLaneMaterial(source));
  const children = parent.children[0].children;
  const stalls = children
    .filter((o) => o.userData.marketVariant)
    .map((o) => ({
      id: o.name,
      variant: o.userData.marketVariant,
      position: o.position.toArray(),
      rotationY: o.rotation.y,
    }));
  const lane = parent.getObjectByName('Market_Paved_Lane') as THREE.Mesh;
  const road = {
    positions: Array.from(lane.geometry.attributes.position.array),
    indices: Array.from(lane.geometry.index!.array),
    uv: Array.from(lane.geometry.attributes.uv.array),
  };
  const ground: number[][] = [];
  for (let z = -35; z <= 35; z++) for (let x = -58; x <= -26; x++) ground.push([x, terrainHeight(x, z), z]);
  mkdirSync('reports/festival-market', { recursive: true });
  writeFileSync(
    'reports/festival-market/layout.json',
    JSON.stringify({ asset: catalog.environment.marketStalls, stalls, road, ground, groundColumns: 33 }),
  );
  parent.add(source.scene);
  disposeObjectTree(parent);
  console.log(`Exported ${stalls.length} stalls and the paved lane.`);
}
void main();
