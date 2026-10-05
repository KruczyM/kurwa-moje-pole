import * as THREE from 'three';
import { terrainHeight } from './terrainHeight';
import { AuthoredFestivalWorld } from './AuthoredFestivalWorld';
export { terrainHeight } from './terrainHeight';
import { FestivalWheel } from './festivalWheel';
import { FestivalInfrastructureInstance } from './festivalInfrastructure';
import { type FestivalPropsInstance } from './festivalProps';
import { FlankiGame } from '../interactions/FlankiGame';
import { flankiPitchGrassCoverage } from '../interactions/FlankiPhysics';
import { FestivalStageEffects } from './festivalStageEffects';
import { ColliderSpatialGrid, type WorldCollider } from './ColliderSpatialGrid';
import { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { inspectableItems } from '../interactions/itemConfig';
import { itemPresentation } from '../interactions/itemPresentationConfig';
import { enableInteractionLayer } from '../interactions/InteractionManager';
import { HorizonPanorama, TimeOfDaySkybox, type SkyboxPeriod, type SkyboxVariant } from './HorizonSkybox';
import type { PhysicalSize, TentFit } from './campLayout';
import { MAD_DOG_CONFIG } from './campLandmarks';
import { Grass } from './vendor/three-stylized/index';
import { bindGrassWorldMask, createGrassWorldMask } from './grassWorldMask';
import { DEFAULT_GRASS_PRESET, grassDensityForSurface, type GrassQualityPreset } from './grassQuality';
import { RECYCLING_CORRALS } from '../interactions/CanCollector';
import { createEcoPickupModel } from './ecoPickupModels';

import { WORLD_SIZE, WORLD_LIMIT } from './festivalLayout';
export { WORLD_LIMIT } from './festivalLayout';
/** Wysokość wcTronu: co najmniej dwukrotność nominalnej postaci mierzącej 1,8 m. */
export const TOILET_HEIGHT_METERS = 3.6;
export const PROCEDURAL_GRASS_ENABLED = false;

export type WorldObject =
  | { object: THREE.Object3D; label: string; action: 'toilet' }
  | { object: THREE.Object3D; label: string; action: 'seat'; seatId: string }
  | { object: THREE.Object3D; label: string; action: 'item'; itemId: string }
  | { object: THREE.Object3D; label: string; action: 'toitoi_door'; doorId: string }
  | { object: THREE.Object3D; label: string; action: 'field_shower'; showerId: string }
  | { object: THREE.Object3D; label: string; action: 'patrol_checkpoint' }
  | { object: THREE.Object3D; label: string; action: 'flanki' }
  | { object: THREE.Object3D; label: string; action: 'flanki_can' }
  | { object: THREE.Object3D; label: string; action: 'ferris_wheel' }
  | { object: THREE.Object3D; label: string; action: 'clean_can'; canId: string }
  | { object: THREE.Object3D; label: string; action: 'clean_corral' }
  | { object: THREE.Object3D; label: string; action: 'campfire_guitar' };

export type GroundTextures = {
  grassColor?: THREE.Texture | null;
  grassNormal?: THREE.Texture | null;
  grassRoughness?: THREE.Texture | null;
  horizon?: THREE.Texture | null;
};

type WorldModels = {
  ecoPickups?: GLTF | null;
  authoredFestival: GLTF;
  characters?: Map<string, GLTF>;
  beerCan: GLTF | null;
  interactables: Map<string, GLTF>;
  textures?: GroundTextures;
};

/** Tworzy prosty matowy materiał używany przez modele zastępcze. */
const simpleMaterial = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 0.78 });

/** Tworzy fakturowany materiał ziemi PBR na bazie map albedo, normalnych i roughness. */
export function createGroundMaterial(textures?: GroundTextures) {
  if (textures?.grassColor && textures?.grassNormal && textures?.grassRoughness) {
    const repeat = WORLD_SIZE / 1.4;
    textures.grassColor.repeat.set(repeat, repeat);
    textures.grassColor.wrapS = THREE.RepeatWrapping;
    textures.grassColor.wrapT = THREE.RepeatWrapping;
    textures.grassColor.colorSpace = THREE.SRGBColorSpace;

    textures.grassNormal.repeat.set(repeat, repeat);
    textures.grassNormal.wrapS = THREE.RepeatWrapping;
    textures.grassNormal.wrapT = THREE.RepeatWrapping;
    textures.grassNormal.colorSpace = THREE.NoColorSpace;

    textures.grassRoughness.repeat.set(repeat, repeat);
    textures.grassRoughness.wrapS = THREE.RepeatWrapping;
    textures.grassRoughness.wrapT = THREE.RepeatWrapping;
    textures.grassRoughness.colorSpace = THREE.NoColorSpace;
    for (const texture of [textures.grassColor, textures.grassNormal, textures.grassRoughness])
      texture.anisotropy = 8;

    const material = new THREE.MeshStandardMaterial({
      map: textures.grassColor,
      normalMap: textures.grassNormal,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughnessMap: textures.grassRoughness,
      roughness: 0.88,
      metalness: 0.0,
      color: 0xffffff,
    });
    // The meadow must remain visible when individual blades become sub-pixel.
    // Retain photographic detail and PBR lighting, but remove the dry-earth cast.
    material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        float meadowValue = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
        vec3 meadowTint = vec3(0.48, 0.76, 0.27) * max(meadowValue, 0.035);
        diffuseColor.rgb = mix(diffuseColor.rgb, meadowTint, 0.72);`,
      );
    };
    material.customProgramCacheKey = () => 'festival-meadow-v1';
    return material;
  }
  return simpleMaterial(0x1a3816);
}

/** Włącza podgląd hitboxów przez parametr adresu `?debugInteractions=1`. */
export function interactionDebugEnabled(search: string) {
  return new URLSearchParams(search).get('debugInteractions') === '1';
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
  private wheel: FestivalWheel | null = null;
  public infrastructure: FestivalInfrastructureInstance | null = null;
  public festivalProps: FestivalPropsInstance | null = null;
  public flankiGame: FlankiGame | null = null;
  private stageEffects: FestivalStageEffects | null = null;
  private landmarksRoot: THREE.Group | null = null;
  private sun!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private readonly colliderGrid = new ColliderSpatialGrid(16);
  private readonly canMeshes = new Map<string, THREE.Object3D>();
  private ecoModelSource?: THREE.Object3D;
  private spawnOrigin = new THREE.Vector3(0, 0, 15);
  public mapScenery: AuthoredFestivalWorld['mapScenery'] = [];
  colliders: WorldCollider[] = [];

  getWheel(): FestivalWheel | null {
    return this.wheel;
  }

  /** Start outside the authored toilet, even after models are moved in Blender. */
  getPlayerSpawn() {
    for (let radius = 0; radius <= 30; radius += 1)
      for (let i = 0; i < 16; i++) {
        const angle = (i / 16) * Math.PI * 2;
        const x = this.spawnOrigin.x + Math.sin(angle) * radius;
        const z = this.spawnOrigin.z + Math.cos(angle) * radius;
        if (this.canMove(x, z, 0.5)) return { position: [x, z] as const, yaw: Math.atan2(x, z) };
      }
    throw new Error('No safe spawn near the authored main camp');
  }

  addCollider(collider: WorldCollider): void {
    this.colliders.push(collider);
    this.colliderGrid.add(collider);
  }
  interactables: WorldObject[] = [];
  private grass: Grass | null = null;
  private grassWorldMask: THREE.DataTexture | null = null;
  private grassQuality: GrassQualityPreset = DEFAULT_GRASS_PRESET;
  private skybox: TimeOfDaySkybox;
  private panorama: HorizonPanorama;
  private readonly debugInteractions: boolean;

  constructor(
    scene: THREE.Scene,
    models: WorldModels,
    debugInteractions = interactionDebugEnabled(typeof location === 'undefined' ? '' : location.search),
    grassQuality: GrassQualityPreset = DEFAULT_GRASS_PRESET,
  ) {
    this.ecoModelSource = models.ecoPickups?.scene;
    this.debugInteractions = debugInteractions;
    this.grassQuality = grassQuality;
    this.skybox = new TimeOfDaySkybox(scene);
    this.panorama = new HorizonPanorama(models.textures?.horizon);
    this.panorama.mesh.userData.excludeMushroomWireframe = true;
    scene.add(this.panorama.mesh);

    this.hemiLight = new THREE.HemisphereLight(0xb9dcff, 0x4b3c23, 1.7);
    scene.add(this.hemiLight);
    const sun = new THREE.DirectionalLight(0xffe0b0, 3.2);
    this.sun = sun;
    sun.position.set(-10, 17, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -22;
    sun.shadow.camera.right = 22;
    sun.shadow.camera.top = 22;
    sun.shadow.camera.bottom = -22;
    scene.add(sun);

    const ground = new THREE.Mesh(terrain(), createGroundMaterial(models.textures));
    ground.receiveShadow = true;
    ground.userData.excludeMushroomWireframe = true;
    scene.add(ground);

    const authored = new AuthoredFestivalWorld(models.authoredFestival);
    this.mapScenery = authored.mapScenery;
    scene.add(authored.root);
    const toilet = authored.placements.get('CampToilet');
    if (toilet) {
      const bounds = new THREE.Box3().setFromObject(toilet);
      this.spawnOrigin.set((bounds.min.x + bounds.max.x) / 2, 0, bounds.max.z + 2.8);
    }
    const vegetationCoverage = (x: number, z: number) =>
      Math.min(authored.grassCoverage(x, z), flankiPitchGrassCoverage(x, z));
    if (PROCEDURAL_GRASS_ENABLED) {
      this.grass = new Grass(
        {
          surface: ground,
          grass: {
            density: grassDensityForSurface(18, WORLD_SIZE, WORLD_SIZE),
            brightness: 0.44,
            coverage: {
              sample: (point) => vegetationCoverage(point.position.x, point.position.z),
            },
            blade: { minHeight: 0.18, maxHeight: 0.58, minWidth: 0.025, maxWidth: 0.085, segments: 4 },
            colors: { bottom: '#163313', top: '#2c581e', backlight: '#44782b', ground: '#142911' },
            wind: {
              strength: 0.16,
              speed: 0.85,
              frequency: 0.55,
              turbulence: 0.22,
              lean: 0.025,
              direction: 32,
            },
            lighting: { direction: sun.position.clone().normalize(), color: '#ffe0b0', intensity: 1.1 },
            shadow: false,
          },
          wildflowers: { enabled: false },
        },
        this.grassQuality,
      );
      this.grass.blades.visible = false;
      this.grass.userData.excludeMushroomWireframe = true;
      this.grassWorldMask = createGrassWorldMask(vegetationCoverage);
      bindGrassWorldMask(this.grass.tutorialGrass, this.grassWorldMask);
      bindGrassWorldMask(this.grass.distantGrass, this.grassWorldMask);
      this.grass.syncDirectionalLight(sun);
      scene.add(this.grass);
    }

    const landmarksRoot = new THREE.Group();
    landmarksRoot.name = 'RuntimeGameplay';
    this.landmarksRoot = landmarksRoot;
    scene.add(landmarksRoot);
    this.wheel = authored.wheel;
    this.infrastructure = authored.infrastructure;
    this.festivalProps = authored.props;
    authored.colliders.forEach((collider) => this.addCollider(collider));
    this.interactables.push(...authored.interactables);
    const madDogRoot = authored.placements.get('MadDog');
    if (madDogRoot) {
      this.table(madDogRoot, models.interactables);
      const localFill = new THREE.PointLight(
        0xffdfc2,
        MAD_DOG_CONFIG.localFillIntensity,
        MAD_DOG_CONFIG.localFillDistance,
        2,
      );
      localFill.position.y = MAD_DOG_CONFIG.localFillHeight;
      madDogRoot.add(localFill);
    }
    // Sky cones and lasers disabled; keep the authored stage fixtures.

    const flankiCanY = terrainHeight(0, -26);
    this.flankiGame = new FlankiGame({
      canPosition: [0, flankiCanY, -26],
      playerLineZ: -20,
      botLineZ: -32,
      beerCanModel: models.beerCan ?? null,
      characterModels: models.characters,
    });
    landmarksRoot.add(this.flankiGame.root);
    this.interactables.push({
      object: this.flankiGame.interactionHitbox,
      label: 'Zagraj we Flanki (Bierball)',
      action: 'flanki',
    });
    this.interactables.push({
      object: this.flankiGame.canInteractionHitbox,
      label: 'Postaw puszkę! [E]',
      action: 'flanki_can',
    });

    // Gitara akustyczna przy ognisku (CampfireGuitarGame)
    const guitarProp = this.festivalProps?.allProps.get('guitar_campfire');
    if (guitarProp) {
      const guitarHitbox = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 1.4, 1.6),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }),
      );
      guitarHitbox.position.copy(guitarProp.position).add(new THREE.Vector3(0, 0.4, 0));
      guitarHitbox.userData.interaction = {
        kind: 'campfire_guitar',
        label: 'Zagraj na gitarze przy ognisku [E]',
      };
      guitarHitbox.userData.interactionRoot = guitarHitbox;
      enableInteractionLayer(guitarHitbox);
      landmarksRoot.add(guitarHitbox);
      this.interactables.push({
        object: guitarHitbox,
        label: 'Zagraj na gitarze przy ognisku [E]',
        action: 'campfire_guitar',
      });
    }

    // 10 puszek do sprzątania pola (CanCollector / Czyste Pole)
    // Round pickups are created on demand by CanCollector, never at world startup.

    // Eko Zagrody odpadów / recyklingu
    RECYCLING_CORRALS.forEach((corral) => {
      const corralMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(corral.radius, corral.radius, 2, 12),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      corralMesh.position.set(corral.x, terrainHeight(corral.x, corral.z) + 1.0, corral.z);
      landmarksRoot.add(corralMesh);
      corralMesh.userData.interaction = { kind: 'clean_corral' };
      corralMesh.userData.entryRadius = corral.radius;
      enableInteractionLayer(corralMesh);
      for (let i = 0; i < 3; i++) {
        const bin = new THREE.Mesh(
          new THREE.BoxGeometry(0.75, 1.1, 0.75),
          new THREE.MeshStandardMaterial({ color: [0x4caf50, 0xffc107, 0x2196f3][i] }),
        );
        bin.position.set(corral.x + (i - 1) * 0.95, terrainHeight(corral.x, corral.z) + 0.55, corral.z);
        landmarksRoot.add(bin);
      }
      const canvas = document.createElement('canvas');
      canvas.width = 768;
      canvas.height = 256;
      const context = canvas.getContext('2d');
      if (context) {
        context.fillStyle = '#10261a';
        context.fillRect(0, 0, 768, 256);
        context.fillStyle = '#b2ff45';
        context.textAlign = 'center';
        context.font = 'bold 58px sans-serif';
        context.fillText('EKO-ZAGRODA', 384, 85);
        context.font = '36px sans-serif';
        context.fillText('SOLO / WYŚCIG / WYNIKI', 384, 150);
        context.fillText('Podejdź i naciśnij E', 384, 208);
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        const sign = new THREE.Mesh(
          new THREE.PlaneGeometry(3.2, 1.06),
          new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }),
        );
        sign.position.set(corral.x, terrainHeight(corral.x, corral.z) + 2.1, corral.z);
        sign.rotation.y = Math.PI;
        landmarksRoot.add(sign);
      }
      if (corral.id === 'trash_corral_market')
        this.mapScenery.push({
          id: 'EcoCorral',
          category: 'Infrastructure',
          x: corral.x,
          z: corral.z,
          width: 4,
          depth: 2,
        });
      this.interactables.push({
        object: corralMesh,
        label: `Eko Zagroda Recyklingu (${corral.label}) [E]`,
        action: 'clean_corral',
      });
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
    // Match the rotated tabletop footprint, not a wide circular exclusion zone.
    const points = [
      [box.min.x, box.min.z],
      [box.max.x, box.min.z],
      [box.max.x, box.max.z],
      [box.min.x, box.max.z],
    ].map(([x, z]) => {
      const point = new THREE.Vector3(x, 0, z).applyMatrix4(tableRoot.matrixWorld);
      return { x: point.x, z: point.z };
    });
    this.addCollider({ box: new THREE.Box3().setFromObject(table), points });

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

  /** Usuwa lub ukrywa obiekt puszki ze świata po jej zebraniu przez gracza. */
  removeCanObject(canId: string): boolean {
    const mesh = this.canMeshes.get(canId);
    if (mesh) {
      mesh.visible = false;
    }
    this.festivalProps?.hideCan(canId);
    const idx = this.interactables.findIndex(
      (entry) => entry.action === 'clean_can' && entry.canId === canId,
    );
    if (idx >= 0) {
      this.interactables.splice(idx, 1);
      return true;
    }
    return Boolean(mesh);
  }

  /** Aktualizuje pozycję i stan zrespawnowanej puszki w świecie 3D */
  respawnCanObject(can: {
    id: string;
    label: string;
    position: [number, number, number];
    isGolden?: boolean;
  }): void {
    let mesh = this.canMeshes.get(can.id);
    const [cx, , cz] = can.position;
    const y = terrainHeight(cx, cz) + 0.18;

    if (!mesh) {
      const index = can.id.startsWith('eco_') ? Number(can.id.slice(4)) : -1;
      const type = index >= 0 ? index % 3 : 0;
      mesh =
        createEcoPickupModel(this.ecoModelSource, can.id) ??
        new THREE.Mesh(
          index % 12 === 11
            ? new THREE.OctahedronGeometry(0.4)
            : index % 12 === 5
              ? new THREE.SphereGeometry(0.36, 8, 6)
              : type === 2
                ? new THREE.BoxGeometry(0.45, 0.035, 0.3)
                : new THREE.CylinderGeometry(
                    type === 1 ? 0.1 : 0.18,
                    type === 1 ? 0.14 : 0.18,
                    type === 1 ? 0.55 : 0.35,
                    8,
                  ),
          new THREE.MeshStandardMaterial({ color: 0xc0c0c0, metalness: 0.8, roughness: 0.3 }),
        );
      if (this.landmarksRoot) {
        this.landmarksRoot.add(mesh);
      }
      this.canMeshes.set(can.id, mesh);
    }

    const type = can.id.startsWith('eco_') ? Number(can.id.slice(4)) % 3 : 0;
    const bonus = can.id.startsWith('eco_') ? Number(can.id.slice(4)) % 12 : -1;
    mesh.position.set(
      cx,
      type === 2 ? terrainHeight(cx, cz) + 0.025 : type === 1 ? terrainHeight(cx, cz) + 0.275 : y,
      cz,
    );
    mesh.visible = true;
    if (bonus === 11 || bonus === 5) mesh.position.y = terrainHeight(cx, cz) + 0.42;
    if (mesh.userData.ecoModel) mesh.position.y = terrainHeight(cx, cz) + 0.01;
    mesh.userData.interaction = { kind: 'clean_can', canId: can.id };
    mesh.userData.entryRadius = 1.2;
    enableInteractionLayer(mesh);

    if (can.isGolden && mesh instanceof THREE.Mesh) {
      (mesh.material as THREE.MeshStandardMaterial).color.setHex(0xffd700);
    } else if (mesh instanceof THREE.Mesh) {
      (mesh.material as THREE.MeshStandardMaterial).color.setHex(
        type === 2 ? 0xe1dbc4 : type === 1 ? 0x4e9c79 : 0xc0c0c0,
      );
      if (bonus === 11 || bonus === 5)
        (mesh.material as THREE.MeshStandardMaterial).color.setHex(bonus === 11 ? 0xb2ff45 : 0xffaa20);
    }

    this.festivalProps?.showCan(can.id);

    // Upewniamy się, że obiekt znajduje się na liście interakcji
    const existingIdx = this.interactables.findIndex(
      (entry) => entry.action === 'clean_can' && entry.canId === can.id,
    );
    if (existingIdx < 0) {
      this.interactables.push({
        object: mesh,
        label: `Podnieś puszkę (${can.label}) [E]`,
        action: 'clean_can',
        canId: can.id,
      });
    }
  }

  /** Sprawdza granice świata oraz kolizje dla gracza i NPC z wykorzystaniem siatki przestrzennej O(1). */
  canMove(x: number, z: number, radius = 0.34) {
    return (
      x > -WORLD_LIMIT + radius &&
      x < WORLD_LIMIT - radius &&
      z > -WORLD_LIMIT + radius &&
      z < WORLD_LIMIT - radius &&
      !this.colliderGrid.hasCollision(x, z, radius)
    );
  }

  /** Ustawia preset jakości trawy i regeneruje geometrię/gęstość runtime. */
  setGrassQuality(quality: GrassQualityPreset) {
    this.grassQuality = quality;
    this.grass?.setQuality(quality);
    if (this.grass) this.grass.blades.visible = false;
  }

  /** Zwraca aktualnie aktywny preset jakości trawy. */
  getGrassQuality(): GrassQualityPreset {
    return this.grassQuality;
  }

  /** Zwraca aktualną porę dnia skyboxa (dzień, wieczór, noc) */
  getTimeOfDay(): SkyboxPeriod {
    return this.skybox.getPeriod();
  }

  /** Ustawia ręcznie porę dnia i dopasowuje oświetlenie sceny */
  setTimeOfDay(period: SkyboxPeriod, variant?: SkyboxVariant): void {
    this.applyTimeOfDayLighting(period, variant);
  }

  /** Zwraca instancję efektów świetlnych sceny i wież delay */
  getStageEffects(): FestivalStageEffects | null {
    return this.stageEffects;
  }

  /** Dostosowuje oświetlenie słońca, nieba i efektów scenicznych do aktualnej pory dnia i skyboxa */
  public applyTimeOfDayLighting(period: SkyboxPeriod, variant?: SkyboxVariant): void {
    if (period === 'day') {
      this.sun.color.setHex(0xfff1dc);
      this.sun.intensity = 3.2;
      this.sun.position.set(-10, 18, 8);
      this.hemiLight.color.setHex(0xb9dcff);
      this.hemiLight.groundColor.setHex(0x4b3c23);
      this.hemiLight.intensity = 1.6;
    } else if (period === 'evening') {
      this.sun.color.setHex(0xff7a33);
      this.sun.intensity = 2.0;
      this.sun.position.set(-24, 7, 10);
      this.hemiLight.color.setHex(0xff7755);
      this.hemiLight.groundColor.setHex(0x2d1810);
      this.hemiLight.intensity = 1.1;
    } else {
      // night
      if (variant === 'nebula') {
        this.sun.color.setHex(0x6644bb);
        this.sun.intensity = 0.55;
        this.hemiLight.color.setHex(0x3d1c5a);
        this.hemiLight.groundColor.setHex(0x0c0714);
        this.hemiLight.intensity = 0.5;
      } else {
        this.sun.color.setHex(0x3366aa);
        this.sun.intensity = 0.4;
        this.hemiLight.color.setHex(0x182438);
        this.hemiLight.groundColor.setHex(0x060a12);
        this.hemiLight.intensity = 0.45;
      }
      this.sun.position.set(-8, 16, 6);
    }
    if (this.stageEffects) this.stageEffects.group.visible = period !== 'day';
    this.grass?.syncDirectionalLight(this.sun);
  }

  /** Aktualizuje proceduralną animację trawy, skybox oraz pozycję panoramy horyzontu. */
  update(time: number, cameraPosition?: THREE.Vector3, deltaSeconds = 0, reduceMotion = false) {
    this.wheel?.update(deltaSeconds, reduceMotion);
    this.infrastructure?.update(deltaSeconds);
    this.stageEffects?.update(deltaSeconds);
    this.flankiGame?.update(deltaSeconds);
    this.grass?.update(time);
    this.skybox.update();
    if (cameraPosition) this.panorama.update(cameraPosition);
  }

  /** Zwalnia zasoby panoramy, skyboxa, trawy oraz tablice runtime świata. */
  dispose() {
    this.wheel?.dispose();
    this.wheel = null;
    this.infrastructure?.dispose();
    this.infrastructure = null;
    this.festivalProps?.dispose();
    this.festivalProps = null;
    this.flankiGame?.dispose();
    this.flankiGame = null;
    this.stageEffects?.dispose();
    this.stageEffects = null;
    this.canMeshes.clear();
    this.panorama.dispose();
    this.skybox.dispose();
    this.grass?.dispose();
    this.grassWorldMask?.dispose();
    this.colliders.length = 0;
    this.colliderGrid.clear();
    this.interactables.length = 0;
  }
}
