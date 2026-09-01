import * as THREE from 'three';
import { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { inspectableItems } from '../interactions/itemConfig';
import { itemPresentation } from '../interactions/itemPresentationConfig';
import { TimeOfDaySkybox } from './HorizonSkybox';
import { Grass } from './vendor/three-stylized/index';

const WORLD_SIZE = 117.6;
const WORLD_LIMIT = WORLD_SIZE / 2;

export type WorldObject = { object: THREE.Object3D; label: string; action: 'toilet' | 'item' };
type WorldModels = {
  largeTent: GLTF | null;
  smallTent: GLTF | null;
  flag: GLTF | null;
  toilet: GLTF | null;
  interactables: Map<string, GLTF>;
};

/** Tworzy prosty matowy materiał używany przez modele zastępcze. */
const simpleMaterial = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 0.78 });

/** Generuje delikatnie pofalowaną geometrię ziemi. */
export function terrainHeight(x: number, z: number) {
  return 0.18 * Math.sin(x * 0.065) * Math.cos(z * 0.055) + 0.09 * Math.sin(x * 0.19 + z * 0.13);
}

function terrain() {
  const geometry = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, 96, 96).rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index),
      z = positions.getZ(index);
    positions.setY(index, terrainHeight(x, z));
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

/** Zwraca największy wymiar aktualnego bounding boxu modelu. */
function largestDimension(object: THREE.Object3D) {
  const size = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
  return Math.max(0.01, size.x, size.y, size.z);
}

/** Buduje teren, oświetlenie, obiekty obozu, kolizje i punkty interakcji. */
export class CampWorld {
  colliders: ({ x: number; z: number; r: number } | { box: THREE.Box3 })[] = [];
  interactables: WorldObject[] = [];
  private grass: Grass;
  private skybox: TimeOfDaySkybox;

  constructor(scene: THREE.Scene, models: WorldModels) {
    const sky = new Sky();
    sky.scale.setScalar(450000);
    sky.visible = false;
    scene.add(sky);
    this.skybox = new TimeOfDaySkybox(scene);

    scene.add(new THREE.HemisphereLight(0xb9dcff, 0x4b3c23, 1.7));
    const sun = new THREE.DirectionalLight(0xffe0b0, 3.2);
    sun.position.set(-10, 17, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -22;
    sun.shadow.camera.right = 22;
    sun.shadow.camera.top = 22;
    sun.shadow.camera.bottom = -22;
    scene.add(sun);

    const ground = new THREE.Mesh(terrain(), simpleMaterial(0x56732d));
    ground.receiveShadow = true;
    ground.userData.excludeMushroomWireframe = true;
    scene.add(ground);

    this.grass = new Grass({
      surface: ground,
      grass: {
        density: 17,
        brightness: 0.38,
        blade: { minHeight: 0.18, maxHeight: 0.58, minWidth: 0.025, maxWidth: 0.085, segments: 4 },
        colors: { bottom: '#52632b', top: '#b0a35b', backlight: '#d2c878', ground: '#56732d' },
        wind: { strength: 0.16, speed: 0.85, frequency: 0.55, turbulence: 0.22, lean: 0.025, direction: 32 },
        lighting: { direction: sun.position.clone().normalize(), color: '#ffe0b0', intensity: 1.1 },
        shadow: false,
      },
      wildflowers: { enabled: false },
    });
    this.grass.userData.excludeMushroomWireframe = true;
    this.grass.syncDirectionalLight(sun);
    scene.add(this.grass);

    this.tarp(scene);
    this.placeTent(scene, models.largeTent, new THREE.Vector3(-8, 0, -5), 3.2);
    (
      [
        [-8, 3, 0.4],
        [-2, 7, 0.1],
        [5, 6, -0.5],
        [8, 2, 0.4],
        [7, -5, 0],
        [-3, -7, 0.7],
      ] as const
    ).forEach(([x, z, rotation]) =>
      this.placeTent(scene, models.smallTent, new THREE.Vector3(x, 0, z), 1.8, rotation),
    );
    this.toilet(scene, models.toilet);
    this.mast(scene, models.flag);
    this.table(scene, models.interactables);
  }

  /** Klonuje model, dopasowuje jego wysokość oraz konfiguruje cienie. */
  private prepare(model: GLTF | null, height: number, color: number) {
    if (!model) return new THREE.Mesh(new THREE.ConeGeometry(1.7, 1.7, 4), simpleMaterial(color));
    const root = clone(model.scene),
      box = new THREE.Box3().setFromObject(root);
    root.scale.setScalar(height / Math.max(0.01, box.max.y - box.min.y));
    box.setFromObject(root);
    root.position.y = -box.min.y;
    root.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    return root;
  }

  /** Umieszcza namiot i dodaje jego rzeczywisty bounding box do kolizji. */
  private placeTent(
    scene: THREE.Scene,
    source: GLTF | null,
    position: THREE.Vector3,
    height: number,
    rotation = 0,
  ) {
    const object = this.prepare(source, height, 0x5c8dbe);
    object.position.add(position);
    object.rotation.y = rotation;
    scene.add(object);
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object);
    box.min.y = -2;
    box.max.y = 4;
    this.colliders.push({ box });
  }

  /** Tworzy centralną plandekę wraz ze słupami i kolizjami. */
  private tarp(scene: THREE.Scene) {
    const tarp = new THREE.Mesh(new THREE.PlaneGeometry(8, 6, 8, 6), simpleMaterial(0x111119));
    tarp.rotation.x = -Math.PI / 2;
    tarp.position.y = 3.15;
    tarp.castShadow = true;
    scene.add(tarp);
    (
      [
        [-4, -3],
        [4, -3],
        [-4, 3],
        [4, 3],
      ] as const
    ).forEach(([x, z]) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.2, 8), simpleMaterial(0x3d3d41));
      pole.position.set(x, 1.6, z);
      scene.add(pole);
      this.colliders.push({ x, z, r: 0.25 });
    });
  }

  /** Umieszcza docelowy wcTron, collider kabiny i kierunkową interakcję przed drzwiami. */
  private toilet(scene: THREE.Scene, source: GLTF | null) {
    const x = -12;
    const z = 10;
    const toilet = new THREE.Group();
    toilet.name = 'CampToilet_wcTron';
    const cabin = source
      ? this.prepare(source, 2.65, 0x356ddb)
      : new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.65, 1.25), simpleMaterial(0x356ddb));
    if (!source) cabin.position.y = 2.65 / 2;
    cabin.name = 'ToiletCabin';
    toilet.add(cabin);

    const localBounds = new THREE.Box3().setFromObject(cabin);
    const size = localBounds.getSize(new THREE.Vector3());
    const center = localBounds.getCenter(new THREE.Vector3());
    const entrance = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(0.72, size.x * 0.72), size.y * 0.72, 0.16),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        colorWrite: false,
      }),
    );
    entrance.name = 'ToiletEntranceInteraction';
    entrance.position.set(center.x, localBounds.min.y + size.y * 0.48, localBounds.max.z + 0.14);
    entrance.userData.interaction = { kind: 'toilet' };
    entrance.userData.interactionFacing = [0, 0, 1];
    entrance.userData.interactionRoot = entrance;
    toilet.add(entrance);

    toilet.position.set(x, terrainHeight(x, z), z);
    scene.add(toilet);
    toilet.updateMatrixWorld(true);
    this.colliders.push({ box: new THREE.Box3().setFromObject(cabin) });
    this.interactables.push({ object: entrance, label: 'Wejdź do toi-toia', action: 'toilet' });
  }

  /** Umieszcza maszt z flagą i dodaje jego kolizję. */
  private mast(scene: THREE.Scene, source: GLTF | null) {
    const mast = this.prepare(source, 5.8, 0x303035);
    mast.position.set(0, 0, 13);
    scene.add(mast);
    this.colliders.push({ x: 0, z: 13, r: 0.4 });
  }

  /** Buduje stół i układa na nim wszystkie używki w pozycji leżącej. */
  private table(scene: THREE.Scene, models: Map<string, GLTF>) {
    const tableRoot = new THREE.Group();
    tableRoot.name = 'CampTable';
    tableRoot.position.set(3, 0, 4);
    tableRoot.rotation.y = -0.5;

    const table = models.get('table')
      ? clone(models.get('table')!.scene)
      : new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.16, 1.2), simpleMaterial(0x73451f));
    const box = new THREE.Box3().setFromObject(table);
    table.scale.setScalar(1.12 / Math.max(0.01, box.max.y - box.min.y));
    box.setFromObject(table);
    table.position.y = -box.min.y;
    box.setFromObject(table);
    const tableTop = box.max.y;
    tableRoot.add(table);
    scene.add(tableRoot);
    this.colliders.push({ x: 3, z: 4, r: 1.35 });

    inspectableItems.forEach((item) => {
      const source = models.get(item.id);
      const model = source
        ? clone(source.scene)
        : new THREE.Mesh(new THREE.IcosahedronGeometry(0.11), simpleMaterial(0xa8e04a));
      const presentation = itemPresentation[item.id];
      model.rotation.set(...presentation.tableRotation);
      model.scale.setScalar(presentation.tableSize / largestDimension(model));
      box.setFromObject(model);
      model.position.y = -box.min.y;

      // Osobny, nieskalowany korzeń zapobiega kurczeniu strefy interakcji razem z modelem.
      const interactionRoot = new THREE.Group();
      interactionRoot.name = `InspectableItem_${item.id}`;
      interactionRoot.position.set(presentation.tablePosition[0], tableTop, presentation.tablePosition[1]);
      interactionRoot.userData.interaction = { kind: 'item', itemId: item.id };
      interactionRoot.add(model);

      const hitbox = new THREE.Mesh(
        new THREE.SphereGeometry(0.36, 10, 8),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
      );
      hitbox.name = `InteractionHitbox_${item.id}`;
      hitbox.position.y = 0.18;
      interactionRoot.add(hitbox);
      interactionRoot.traverse((child) => (child.userData.interactionRoot = interactionRoot));
      tableRoot.add(interactionRoot);
      this.interactables.push({ object: interactionRoot, label: `Obejrzyj: ${item.label}`, action: 'item' });
    });
  }

  /** Sprawdza granice świata oraz kolizje dla gracza i NPC. */
  canMove(x: number, z: number) {
    const radius = 0.34;
    return (
      x > -WORLD_LIMIT + radius &&
      x < WORLD_LIMIT - radius &&
      z > -WORLD_LIMIT + radius &&
      z < WORLD_LIMIT - radius &&
      !this.colliders.some((collider) =>
        'box' in collider
          ? x > collider.box.min.x - radius &&
            x < collider.box.max.x + radius &&
            z > collider.box.min.z - radius &&
            z < collider.box.max.z + radius
          : Math.hypot(x - collider.x, z - collider.z) < collider.r + radius,
      )
    );
  }

  /** Aktualizuje proceduralną animację trawy. */
  update(time: number) {
    this.grass.update(time);
    this.skybox.update();
  }

  /** Zwalnia zasoby trawy oraz tablice runtime świata. */
  dispose() {
    this.skybox.dispose();
    this.grass.dispose();
    this.colliders.length = 0;
    this.interactables.length = 0;
  }
}
