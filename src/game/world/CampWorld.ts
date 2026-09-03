import * as THREE from 'three';
import { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { inspectableItems } from '../interactions/itemConfig';
import { itemPresentation } from '../interactions/itemPresentationConfig';
import { enableInteractionLayer } from '../interactions/InteractionManager';
import { TimeOfDaySkybox } from './HorizonSkybox';
import { tentColliderBounds, tentLayout, type TentConfig, type TentModelId } from './campLayout';
import { fabricWind, FLAG_CONFIG, MAD_DOG_CONFIG, seatLayout } from './campLandmarks';
import { Grass } from './vendor/three-stylized/index';

const WORLD_SIZE = 117.6;
const WORLD_LIMIT = WORLD_SIZE / 2;
/** Wysokość wcTronu: co najmniej dwukrotność nominalnej postaci mierzącej 1,8 m. */
export const TOILET_HEIGHT_METERS = 3.6;

export type WorldObject =
  | { object: THREE.Object3D; label: string; action: 'toilet' }
  | { object: THREE.Object3D; label: string; action: 'seat'; seatId: string }
  | { object: THREE.Object3D; label: string; action: 'item'; itemId: string };
type WorldModels = {
  tents: Map<TentModelId, GLTF>;
  flag: GLTF | null;
  chair: GLTF | null;
  toilet: GLTF | null;
  interactables: Map<string, GLTF>;
};

/** Tworzy prosty matowy materiał używany przez modele zastępcze. */
const simpleMaterial = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 0.78 });

/** Włącza podgląd hitboxów przez parametr adresu `?debugInteractions=1`. */
export function interactionDebugEnabled(search: string) {
  return new URLSearchParams(search).get('debugInteractions') === '1';
}

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
  private canopy?: THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
  private flagSway?: THREE.Group;
  private readonly debugInteractions: boolean;

  constructor(
    scene: THREE.Scene,
    models: WorldModels,
    debugInteractions = interactionDebugEnabled(typeof location === 'undefined' ? '' : location.search),
  ) {
    this.debugInteractions = debugInteractions;
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

    const campRoot = new THREE.Group();
    campRoot.name = 'CampRoot';
    const madDogRoot = new THREE.Group();
    madDogRoot.name = 'MadDog';
    const tentsRoot = new THREE.Group();
    tentsRoot.name = 'Tents_T01-T15';
    const landmarksRoot = new THREE.Group();
    landmarksRoot.name = 'CampLandmarks';
    const propsRoot = new THREE.Group();
    propsRoot.name = 'CampProps';
    campRoot.add(madDogRoot, tentsRoot, landmarksRoot, propsRoot);
    scene.add(campRoot);

    this.tarp(madDogRoot);
    this.chairs(madDogRoot, models.chair);
    tentLayout.forEach((tent) => this.placeTent(tentsRoot, models.tents.get(tent.model) ?? null, tent));
    this.toilet(propsRoot, models.toilet);
    this.mast(landmarksRoot, models.flag);
    this.table(propsRoot, models.interactables);
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

  /** Umieszcza namiot i buduje jego uproszczony collider wyłącznie z konfiguracji obozu. */
  private placeTent(scene: THREE.Object3D, source: GLTF | null, config: TentConfig) {
    const object = this.prepare(source, config.scale, 0x5c8dbe);
    const [x, y, z] = config.position;
    object.name = config.id;
    object.userData.campObject = {
      id: config.id,
      label: config.label,
      model: config.model,
    };
    object.position.add(new THREE.Vector3(x, y + terrainHeight(x, z), z));
    object.rotation.y = config.rotationY;
    scene.add(object);
    scene.updateMatrixWorld(true);
    const bounds = tentColliderBounds(config);
    const box = new THREE.Box3(
      new THREE.Vector3(bounds.minX, -2, bounds.minZ),
      new THREE.Vector3(bounds.maxX, 4, bounds.maxZ),
    );
    this.colliders.push({ box });
  }

  /** Tworzy otwarte zadaszenie, miękkie światło, masywne słupy i bezkolizyjne linki. */
  private tarp(parent: THREE.Group) {
    const [width, depth] = MAD_DOG_CONFIG.size;
    const geometry = new THREE.PlaneGeometry(width, depth, 12, 9).rotateX(-Math.PI / 2);
    const material = new THREE.MeshStandardMaterial({
      color: 0x16151b,
      roughness: 0.92,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    this.canopy = new THREE.Mesh(geometry, material);
    this.canopy.name = 'MadDog_Canopy_NoCollision';
    this.canopy.position.y = MAD_DOG_CONFIG.height;
    this.canopy.castShadow = true;
    this.canopy.receiveShadow = true;
    parent.add(this.canopy);

    const fill = new THREE.HemisphereLight(0xffe7cf, 0x55475f, MAD_DOG_CONFIG.fillLightIntensity);
    fill.name = 'MadDog_FillLight';
    parent.add(fill);

    const corners = [
      [-width / 2, -depth / 2],
      [width / 2, -depth / 2],
      [-width / 2, depth / 2],
      [width / 2, depth / 2],
    ] as const;
    corners.forEach(([x, z], index) => {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(
          MAD_DOG_CONFIG.poleRadius,
          MAD_DOG_CONFIG.poleRadius * 1.2,
          MAD_DOG_CONFIG.height,
          10,
        ),
        simpleMaterial(0x3d3d41),
      );
      pole.name = `MadDog_Pole_${index + 1}`;
      pole.position.set(x, MAD_DOG_CONFIG.height / 2, z);
      pole.castShadow = true;
      parent.add(pole);
      this.colliders.push({ x, z, r: MAD_DOG_CONFIG.poleRadius + 0.16 });

      const anchorX = x + Math.sign(x) * 0.7;
      const anchorZ = z + Math.sign(z) * 0.7;
      const rope = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x, MAD_DOG_CONFIG.height - 0.08, z),
          new THREE.Vector3(anchorX, 0.08, anchorZ),
        ]),
        new THREE.LineBasicMaterial({ color: 0xaaa397, transparent: true, opacity: 0.72 }),
      );
      rope.name = `MadDog_Guyline_NoCollision_${index + 1}`;
      parent.add(rope);
    });
  }

  /** Ustawia osiem interaktywnych krzeseł w kręgu pod Mad Dogiem. */
  private chairs(parent: THREE.Group, source: GLTF | null) {
    seatLayout.forEach((seat) => {
      const root = new THREE.Group();
      root.name = `Seat_${seat.id}`;
      root.position.set(...seat.position);
      root.rotation.y = seat.rotationY;
      root.userData.interaction = {
        kind: 'seat',
        seatId: seat.id,
        position: [...seat.position],
        rotationY: seat.rotationY,
      };
      const chair = this.prepare(source, 1.05, 0x385c82);
      chair.name = `SeatVisual_${seat.id}`;
      chair.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.material = Array.isArray(mesh.material)
          ? mesh.material.map((material) => material.clone())
          : mesh.material.clone();
      });
      root.add(chair);
      const hitbox = new THREE.Mesh(
        new THREE.BoxGeometry(1.05, 1.25, 0.9),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }),
      );
      hitbox.name = `InteractionHitbox_Seat_${seat.id}`;
      hitbox.position.y = 0.62;
      root.add(hitbox);
      root.traverse((child) => (child.userData.interactionRoot = root));
      enableInteractionLayer(root);
      parent.add(root);
      this.colliders.push({ x: seat.position[0], z: seat.position[2], r: 0.48 });
      this.interactables.push({
        object: root,
        label: `Usiądź (${seat.id})`,
        action: 'seat',
        seatId: seat.id,
      });
    });
  }

  /** Umieszcza docelowy wcTron, collider kabiny i kierunkową interakcję przed drzwiami. */
  private toilet(scene: THREE.Object3D, source: GLTF | null) {
    const x = -12;
    const z = 10;
    const toilet = new THREE.Group();
    toilet.name = 'CampToilet_wcTron';
    const cabin = source
      ? this.prepare(source, TOILET_HEIGHT_METERS, 0x356ddb)
      : new THREE.Mesh(new THREE.BoxGeometry(1.5, TOILET_HEIGHT_METERS, 1.5), simpleMaterial(0x356ddb));
    if (!source) cabin.position.y = TOILET_HEIGHT_METERS / 2;
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
    enableInteractionLayer(entrance);
    toilet.add(entrance);

    toilet.position.set(x, terrainHeight(x, z), z);
    scene.add(toilet);
    toilet.updateMatrixWorld(true);
    this.colliders.push({ box: new THREE.Box3().setFromObject(cabin) });
    this.interactables.push({ object: entrance, label: 'Wejdź do toi-toia', action: 'toilet' });
  }

  /** Buduje wysoki maszt i osobną, bezkolizyjną flagę w centralnej części obozu. */
  private mast(parent: THREE.Group, source: GLTF | null) {
    const root = new THREE.Group();
    root.name = FLAG_CONFIG.id;
    root.position.set(...FLAG_CONFIG.position);
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(
        FLAG_CONFIG.mastRadius,
        FLAG_CONFIG.mastRadius * 1.25,
        FLAG_CONFIG.mastHeight,
        12,
      ),
      simpleMaterial(0x34363b),
    );
    mast.name = 'FlagMast_Collider';
    mast.position.y = FLAG_CONFIG.mastHeight / 2;
    mast.castShadow = true;
    root.add(mast);

    this.flagSway = new THREE.Group();
    this.flagSway.name = 'FlagFabric_NoCollision';
    this.flagSway.position.y = FLAG_CONFIG.mastHeight - FLAG_CONFIG.flagHeight - 0.18;
    const flag = this.prepare(source, FLAG_CONFIG.flagHeight, 0xf2eadb);
    flag.position.x += FLAG_CONFIG.flagHeight * 0.42;
    this.flagSway.add(flag);
    root.add(this.flagSway);
    parent.add(root);
    this.colliders.push({
      x: FLAG_CONFIG.position[0],
      z: FLAG_CONFIG.position[2],
      r: FLAG_CONFIG.mastRadius + 0.2,
    });
  }

  /** Buduje stół i układa na nim wszystkie używki w pozycji leżącej. */
  private table(scene: THREE.Object3D, models: Map<string, GLTF>) {
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
      for (let copy = 0; copy < item.tableQuantity; copy++) {
        const source = models.get(item.id);
        const model = source
          ? clone(source.scene)
          : new THREE.Mesh(new THREE.IcosahedronGeometry(0.11), simpleMaterial(0xa8e04a));
        const presentation = itemPresentation[item.id];
        model.rotation.set(...presentation.tableRotation);
        model.scale.setScalar(presentation.tableSize / largestDimension(model));
        box.setFromObject(model);
        model.position.y = -box.min.y;
        box.setFromObject(model);

        // Osobny, nieskalowany korzeń zapobiega kurczeniu strefy interakcji razem z modelem.
        const interactionRoot = new THREE.Group();
        interactionRoot.name = `InspectableItem_${item.id}_${copy + 1}`;
        const copyOffset = (copy - (item.tableQuantity - 1) / 2) * 0.1;
        interactionRoot.position.set(
          presentation.tablePosition[0] + copyOffset,
          tableTop,
          presentation.tablePosition[1],
        );
        interactionRoot.userData.interaction = { kind: 'item', itemId: item.id };
        interactionRoot.userData.interactionFacing = [0, 0, 1];
        interactionRoot.add(model);

        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const hitbox = new THREE.Mesh(
          new THREE.BoxGeometry(
            Math.max(0.18, size.x + 0.1),
            Math.max(0.14, size.y + 0.1),
            Math.max(0.18, size.z + 0.1),
          ),
          new THREE.MeshBasicMaterial({
            color: 0xff2f72,
            transparent: true,
            opacity: this.debugInteractions ? 0.35 : 0,
            depthWrite: false,
            colorWrite: this.debugInteractions,
            wireframe: this.debugInteractions,
          }),
        );
        hitbox.name = `InteractionHitbox_${item.id}_${copy + 1}`;
        hitbox.position.copy(center);
        hitbox.userData.debugInteractionHitbox = true;
        interactionRoot.add(hitbox);
        interactionRoot.traverse((child) => (child.userData.interactionRoot = interactionRoot));
        enableInteractionLayer(interactionRoot);
        tableRoot.add(interactionRoot);
        this.interactables.push({
          object: interactionRoot,
          label: `Obejrzyj: ${item.label}`,
          action: 'item',
          itemId: item.id,
        });
      }
    });
  }

  /** Zdejmuje pojedynczy egzemplarz używki ze stołu po zabraniu lub zużyciu. */
  removeItem(itemId: string) {
    const index = this.interactables.findIndex((entry) => entry.action === 'item' && entry.itemId === itemId);
    if (index < 0) return false;
    const [entry] = this.interactables.splice(index, 1);
    entry.object.removeFromParent();
    return true;
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
    if (this.canopy) {
      const positions = this.canopy.geometry.attributes.position;
      for (let index = 0; index < positions.count; index++) {
        positions.setY(index, fabricWind(time, positions.getX(index), positions.getZ(index)));
      }
      positions.needsUpdate = true;
      this.canopy.geometry.computeVertexNormals();
    }
    if (this.flagSway) {
      const wind = fabricWind(time, 2.4, 0.6);
      this.flagSway.rotation.z = wind * 0.8;
      this.flagSway.rotation.y = wind * 1.35;
    }
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
