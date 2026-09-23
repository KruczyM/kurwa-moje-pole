/** Export exact runtime transforms for offline visual QA, not a second runtime loader. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import catalog from '../src/game/assets/assetCatalog.json';
import { festivalTentLayout, prototypeTentLayout } from '../src/game/world/campLayout';
import {
  CAMP_PALETTES,
  FESTIVAL_CAMP_ROADS,
  FESTIVAL_CAMP_SECTORS,
  tentTerrainOffset,
} from '../src/game/world/festivalCamping';
import { terrainHeight } from '../src/game/world/terrainHeight';
import { disposeObjectTree } from '../src/game/lifecycle/disposeThree';

async function main() {
  const sources = new Map<string, THREE.Group>();
  const loader = new GLTFLoader();
  loader.register(() => ({
    name: 'offline-images',
    loadTexture: () => Promise.resolve(new THREE.Texture()),
  }));
  for (const t of prototypeTentLayout) {
    const bytes = readFileSync(`public/game-assets/${catalog.tents[t.model]}`);
    const parsed = await loader.parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      '',
    );
    sources.set(t.model, parsed.scene);
  }
  const tents = festivalTentLayout.map((t) => {
    const root = sources.get(t.model)!;
    const bounds = new THREE.Box3().setFromObject(root);
    const scale = t.physicalSize[1] / bounds.getSize(new THREE.Vector3()).y;
    const floor = new THREE.Box3().setFromObject(root.getObjectByName('Tent_Groundsheet')!);
    const offset = tentTerrainOffset(t, (floor.min.y - bounds.min.y) * scale, terrainHeight);
    return {
      ...t,
      asset: catalog.tents[t.model],
      scale,
      baseY: -bounds.min.y * scale + terrainHeight(t.position[0], t.position[2]) + offset,
    };
  });
  const palettes = Object.fromEntries(
    Object.entries(CAMP_PALETTES).map(([id, colors]) => [
      id,
      Object.fromEntries(
        Object.entries(colors).map(([role, color]) => [role, new THREE.Color(color).toArray()]),
      ),
    ]),
  );
  mkdirSync('reports/festival-camp', { recursive: true });
  writeFileSync(
    'reports/festival-camp/layout.json',
    JSON.stringify({ tents, palettes, sectors: FESTIVAL_CAMP_SECTORS, roads: FESTIVAL_CAMP_ROADS }, null, 2),
  );
  for (const source of sources.values()) disposeObjectTree(source);
  console.log(`Exported ${tents.length} tent transforms to reports/festival-camp/layout.json`);
}
void main();
