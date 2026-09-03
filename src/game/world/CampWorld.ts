import * as THREE from 'three';
import { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { inspectableItems } from '../interactions/itemConfig';
import { itemPresentation } from '../interactions/itemPresentationConfig';
import { enableInteractionLayer } from '../interactions/InteractionManager';
import { TimeOfDaySkybox } from './HorizonSkybox';
import {
  tentColliderBounds,
  tentLayout,
  type PhysicalSize,
  type TentConfig,
  type TentFit,
  type TentModelId,
} from './campLayout';
import { FLAG_CONFIG, MAD_DOG_CONFIG, seatLayout, TOILET_CONFIG } from './campLandmarks';
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

/** Oblicza skalę korzenia GLB z zachowaniem proporcji albo korygując wadliwe proporcje źródła. */
export function physicalScale(source: THREE.Vector3, target: PhysicalSize, fit: TentFit) {
  if (fit === 'uniform-height') {
    const scalar = target[1] / Math.max(0.01, source.y);
    return new THREE.Vector3(scalar, scalar, scalar);
  }
  return new THREE.Vector3(
    target[0] / Math.max(0.01, source.x),
    target[1] / Math.max(0.01, source.y),
    target[2] / Math.max(0.01, source.z),
  );
}

/** Formatuje zmierzone wymiary świata do kontroli w konsoli. */
export function formatTentDimensions(id: string, size: THREE.Vector3) {
  return `${id}: ${size.x.toFixed(2)}m × ${size.z.toFixed(2)}m, wysokość ${size.y.toFixed(2)}m`;
}

/** Sprawdza wynik skalowania z tolerancją 3%; przy skali jednolitej waliduje wysokość referencyjną. */
export function physicalSizeIsValid(actual: THREE.Vector3, target: PhysicalSize, fit: TentFit) {
  const close = (value: number, expected: number) => Math.abs(value - expected) <= expected * 0.03;
  return fit === 'uniform-height'
    ? close(actual.y, target[1])
    : close(actual.x, target[0]) && close(actual.y, target[1]) && close(actual.z, target[2]);
}

/** Buduje teren, oświetlenie, obiekty obozu, kolizje i punkty interakcji. */
export class CampWorld {
  colliders: ({ x: number; z: number; r: number } | { box: THREE.Box3 })[] = [];
  interactables: WorldObject[] = [];
  private grass: Grass;
  private skybox: TimeOfDaySkybox;
  private readonly debugInteractions: boolean;
  private readonly debugTentScale: boolean;

  constructor(
    scene: THREE.Scene,
    models: WorldModels,
    debugInteractions = interactionDebugEnabled(typeof location === 'undefined' ? '' : location.search),
  ) {
    this.debugInteractions = debugInteractions;
    this.debugTentScale =
      typeof location !== 'undefined' && new URLSearchParams(location.search).get('debugTentScale') === '1';
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

    this.madDog(madDogRoot, models.tents.get('main') ?? null);
    this.chairs(madDogRoot, models.chair);
    tentLayout.forEach((tent) => this.placeTent(tentsRoot, models.tents.get(tent.model) ?? null, tent));
    this.toilet(propsRoot, models.toilet);
    this.flag(landmarksRoot, models.flag);
    this.table(madDogRoot, models.interactables);
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

  /** Skaluje cały korzeń modelu do jawnych wymiarów fizycznych i osadza go najniższym punktem na ziemi. */
  private preparePhysical(model: GLTF | null, size: PhysicalSize, fit: TentFit, color: number) {
    if (!model) {
      const fallback = new THREE.Mesh(new THREE.BoxGeometry(...size), simpleMaterial(color));
      fallback.position.y = size[1] / 2;
      return fallback;
    }
    const root = clone(model.scene);
    const bounds = new THREE.Box3().setFromObject(root);
    const sourceSize = bounds.getSize(new THREE.Vector3());
    root.scale.multiply(physicalScale(sourceSize, size, fit));
    if (fit === 'exact-source-correction') {
      bounds.setFromObject(root);
      root.scale.multiply(physicalScale(bounds.getSize(new THREE.Vector3()), size, fit));
    }
    bounds.setFromObject(root);
    root.position.y -= bounds.min.y;
    root.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });
    return root;
  }

  /** Umieszcza namiot i buduje jego uproszczony collider wyłącznie z konfiguracji obozu. */
  private placeTent(scene: THREE.Object3D, source: GLTF | null, config: TentConfig) {
    const object = this.preparePhysical(source, config.physicalSize, config.fit, 0x5c8dbe);
    object.updateMatrixWorld(true);
    const measuredPhysicalSize = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
    if (!physicalSizeIsValid(measuredPhysicalSize, config.physicalSize, config.fit)) {
      console.warn(`Niepoprawna skala namiotu: ${formatTentDimensions(config.id, measuredPhysicalSize)}`);
    }
    const [x, y, z] = config.position;
    object.name = config.id;
    object.userData.campObject = {
      id: config.id,
      label: config.label,
      model: config.model,
    };
    object.position.add(new THREE.Vector3(x, y + terrainHeight(x, z) + (config.groundOffset ?? 0), z));
    object.rotation.y = config.rotationY;
    scene.add(object);
    scene.updateMatrixWorld(true);
    if (this.debugTentScale) {
      console.info(formatTentDimensions(config.id, measuredPhysicalSize));
    }
    const bounds = tentColliderBounds(config);
    const box = new THREE.Box3(
      new THREE.Vector3(bounds.minX, -2, bounds.minZ),
      new THREE.Vector3(bounds.maxX, 4, bounds.maxZ),
    );
    this.colliders.push({ box });
  }

  /** Umieszcza właściwy model Mad Dog zamiast proceduralnej płachty i słupów. */
  private madDog(parent: THREE.Group, source: GLTF | null) {
    const [x, , z] = MAD_DOG_CONFIG.position;
    parent.position.set(x, terrainHeight(x, z), z);
    const canopy = this.preparePhysical(source, MAD_DOG_CONFIG.physicalSize, 'uniform-height', 0x16151b);
    canopy.name = 'MadDog_Model_NoInteriorCollision';
    parent.add(canopy);
    canopy.updateMatrixWorld(true);
    const measured = new THREE.Box3().setFromObject(canopy).getSize(new THREE.Vector3());
    if (!physicalSizeIsValid(measured, MAD_DOG_CONFIG.physicalSize, 'uniform-height')) {
      console.warn(`Niepoprawna skala Mad Dog: ${formatTentDimensions('MAIN', measured)}`);
    } else if (this.debugTentScale) {
      console.info(formatTentDimensions('MAIN', measured));
    }

    const fill = new THREE.HemisphereLight(0xffe7cf, 0x55475f, MAD_DOG_CONFIG.fillLightIntensity);
    fill.name = 'MadDog_FillLight';
    parent.add(fill);
  }

  /** Ustawia osiem interaktywnych krzeseł w kręgu pod Mad Dogiem. */
  private chairs(parent: THREE.Group, source: GLTF | null) {
    // Określ, o ile metrów chcesz odsunąć krzesła od centrum (np. 0.5 metra)
    const offsetDistance = 1;

    seatLayout.forEach((seat) => {
      // 1. Klonujemy pozycję z layoutu, aby nie modyfikować oryginalnych danych
      const seatPosition = [...seat.position];

      // 2. Obliczamy wektor kierunku od centrum (0, 0) na płaszczyźnie XZ
      const x = seatPosition[0];
      const z = seatPosition[2];
      const length = Math.sqrt(x * x + z * z);

      if (length > 0) {
        // Normalizujemy wektor i mnożymy przez odległość odsunięcia
        seatPosition[0] += (x / length) * offsetDistance;
        seatPosition[2] += (z / length) * offsetDistance;
      }

      // 3. Obliczamy pozycję globalną (worldPosition) na podstawie nowej, odsuniętej pozycji
      const worldPosition: [number, number, number] = [
        parent.position.x + seatPosition[0],
        parent.position.y + seatPosition[1],
        parent.position.z + seatPosition[2],
      ];

      const root = new THREE.Group();
      root.name = `Seat_${seat.id}`;

      // Używamy nowej, zmodyfikowanej pozycji
      root.position.set(seatPosition[0], seatPosition[1], seatPosition[2]);
      root.rotation.y = seat.rotationY;
      root.userData.interaction = {
        kind: 'seat',
        seatId: seat.id,
        position: worldPosition,
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

      // Zmodyfikowana pozycja automatycznie aktualizuje colidery i interakcje
      this.colliders.push({ x: worldPosition[0], z: worldPosition[2], r: 0.48 });
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
    const [x, , z] = TOILET_CONFIG.position;
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

  /** Umieszcza kompletny model flaga2, który zawiera już poprawną flagę i konstrukcję. */
  private flag(parent: THREE.Group, source: GLTF | null) {
    const flag = this.prepare(source, FLAG_CONFIG.height, 0xf2eadb);
    flag.name = FLAG_CONFIG.id;
    const [x, , z] = FLAG_CONFIG.position;
    flag.position.add(new THREE.Vector3(x, terrainHeight(x, z), z));
    parent.add(flag);
    this.colliders.push({
      x: FLAG_CONFIG.position[0],
      z: FLAG_CONFIG.position[2],
      r: FLAG_CONFIG.colliderRadius,
    });
  }

  /** Buduje stół i układa na nim wszystkie używki w pozycji leżącej. */
  private table(scene: THREE.Object3D, models: Map<string, GLTF>) {
    const tableRoot = new THREE.Group();
    tableRoot.name = 'CampTable';
    tableRoot.position.set(0, 0, 0);
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
    scene.updateWorldMatrix(true, true);
    const tableWorldPosition = tableRoot.getWorldPosition(new THREE.Vector3());
    this.colliders.push({ x: tableWorldPosition.x, z: tableWorldPosition.z, r: 1.35 });

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
