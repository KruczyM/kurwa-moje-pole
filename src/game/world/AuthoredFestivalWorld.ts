import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FestivalWheel } from './festivalWheel';
import { FestivalInfrastructureInstance, FESTIVAL_INFRASTRUCTURE_PLACEMENTS } from './festivalInfrastructure';
import { FestivalPropsInstance } from './festivalProps';
import { GrzybekWaterParticles } from './festivalGrzybek';
import { enableInteractionLayer } from '../interactions/InteractionManager';
import type { WorldObject } from './CampWorld';
import type { WorldCollider } from './ColliderSpatialGrid';
import type { MapScenery } from '../ui/FestivalMap';
import { tentFootprint } from './tentFootprint';

/** An authored world owns scenery; existing controllers continue to own gameplay. */
export class AuthoredFestivalWorld {
  readonly root: THREE.Object3D;
  readonly placements = new Map<string, THREE.Object3D>();
  readonly colliders: WorldCollider[] = [];
  readonly mapScenery: MapScenery[] = [];
  readonly interactables: WorldObject[] = [];
  readonly infrastructure = new FestivalInfrastructureInstance();
  readonly props = new FestivalPropsInstance();
  wheel: FestivalWheel | null = null;
  private readonly grassExclusions: THREE.Box3[] = [];
  private readonly grassCells = new Map<string, THREE.Box3[]>();

  constructor(source: GLTF) {
    this.root = source.scene.clone(true);
    this.root.name = 'AuthoredFestivalWorld';
    this.root.updateMatrixWorld(true);
    this.root.traverse((obj) => {
      if (typeof obj.userData.runtimePlacement === 'string')
        this.placements.set(obj.userData.runtimePlacement, obj);
      if (obj instanceof THREE.Mesh) {
        if (
          /^Wing_Single_Telebim_(Left|Right)$/.test(
            String(obj.userData.runtimeNode ?? obj.userData.runtimePlacement ?? obj.name),
          )
        )
          obj.userData.authoredDynamic = true; // Live feed materials must never enter static batches.
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    for (const [id, obj] of this.placements) this.bind(id, obj);
    for (const box of this.grassExclusions)
      for (let x = Math.floor(box.min.x / 16); x <= Math.floor(box.max.x / 16); x++)
        for (let z = Math.floor(box.min.z / 16); z <= Math.floor(box.max.z / 16); z++) {
          const key = `${x},${z}`;
          const boxes = this.grassCells.get(key) ?? [];
          boxes.push(box);
          this.grassCells.set(key, boxes);
        }
    this.bindWheel();
    this.bindPatrolGates();
    this.batchStaticMeshes();
  }

  /** Coverage is derived from actual exported footprints, not stale TS positions. */
  grassCoverage = (x: number, z: number): number => {
    for (const box of this.grassCells.get(`${Math.floor(x / 16)},${Math.floor(z / 16)}`) ?? [])
      if (x >= box.min.x && x <= box.max.x && z >= box.min.z && z <= box.max.z) return 0;
    return 1;
  };

  private trigger(obj: THREE.Object3D, action: WorldObject['action'], label: string) {
    const box = new THREE.Box3().setFromObject(obj);
    const hitbox = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 1.8, 1.5),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }),
    );
    hitbox.position.copy(box.getCenter(new THREE.Vector3()));
    hitbox.position.y = Math.max(0.9, box.min.y + 0.9);
    hitbox.name = `InteractionHitbox_${obj.userData.runtimePlacement ?? obj.name}`;
    hitbox.userData.interactionRoot = hitbox;
    hitbox.userData.interaction = { kind: action };
    hitbox.userData.label = label;
    this.root.add(hitbox);
    enableInteractionLayer(hitbox);
    return hitbox;
  }

  private boxCollider(box: THREE.Box3) {
    if (!box.isEmpty()) this.colliders.push({ box: box.clone() });
  }

  private bind(id: string, obj: THREE.Object3D) {
    const box = new THREE.Box3().setFromObject(obj);
    if (box.isEmpty()) return;
    const category = String(obj.userData.runtimeCategory ?? '');
    const path = String(obj.userData.asset_path ?? '');
    const footprint = category === 'Camping' ? tentFootprint(obj) : undefined;
    const mapBox = footprint?.box ?? box;
    obj.userData.campObject = { id, label: id };
    const center = box.getCenter(new THREE.Vector3());
    if (
      ['Roads', 'Camping', 'Passage'].includes(category) ||
      [
        'CampFlag',
        'mainStage',
        'Main_Stage_Deck_Plinth',
        'smallStage',
        'Lidl',
        'foh_tower_main',
        'Sunflower_bed',
        'AllegroWheel',
      ].includes(id) ||
      id.startsWith('StageBarrier_') ||
      /^food_tent_|^foodtruck_/.test(id)
    ) {
      const mapCenter = mapBox.getCenter(new THREE.Vector3());
      this.mapScenery.push({
        id,
        category,
        x: mapCenter.x,
        z: mapCenter.z,
        width: mapBox.max.x - mapBox.min.x,
        depth: mapBox.max.z - mapBox.min.z,
        points: footprint?.points,
      });
    }
    if (category === 'Roads' || id === 'Sunflower_bed') {
      this.grassExclusions.push(box);
      return;
    }
    if (id.startsWith('Sunflower_')) return;
    if (category === 'Camping' || category === 'Stages' || category === 'Passage' || id === 'MadDog')
      this.grassExclusions.push(box);
    if (
      category === 'Camping' ||
      category === 'Passage' ||
      id === 'mainStage' ||
      id.startsWith('StageBarrier_')
    ) {
      if (footprint) this.colliders.push({ box: footprint.box, points: footprint.points });
      else this.boxCollider(box);
    }
    if (id === 'smallStage') {
      // Preserve the open pavilion: collide with walls and raised stage, never its whole roof.
      obj.traverse((part) => {
        const node = String(part.userData.runtimeNode ?? part.name);
        if (
          part instanceof THREE.Mesh &&
          /ASP_(Rear_Wall|Stage_Subdeck|Stage_Skirt)|Tent_Sidewall/.test(node)
        )
          this.boxCollider(new THREE.Box3().setFromObject(part));
      });
    }
    if (id === 'CampFlag') this.colliders.push({ x: center.x, z: center.z, r: 0.28 });
    if (obj.userData.campFlagPole) this.colliders.push({ x: center.x, z: center.z, r: 0.15 });
    if (id === 'CampToilet') {
      this.boxCollider(box);
      this.interactables.push({
        object: this.trigger(obj, 'toilet', 'Wejdź do wcTronu'),
        action: 'toilet',
        label: 'Wejdź do wcTronu',
      });
    }
    if (/^S\d+$/.test(id)) {
      const hitbox = this.trigger(obj, 'seat', `Usiądź (${id})`);
      const quaternion = obj.getWorldQuaternion(new THREE.Quaternion());
      const yaw = new THREE.Euler().setFromQuaternion(quaternion, 'YXZ').y;
      hitbox.userData.interaction = {
        kind: 'seat',
        seatId: id,
        position: [center.x, box.min.y, center.z],
        rotationY: yaw,
      };
      this.colliders.push({ x: center.x, z: center.z, r: 0.48 });
      this.interactables.push({ object: hitbox, action: 'seat', seatId: id, label: `Usiądź (${id})` });
    }
    if (category === 'Props') this.props.allProps.set(id, obj);
    if (obj.userData.campDetail && /table|cooler|crate|pallet/.test(path)) this.boxCollider(box);
    const site = FESTIVAL_INFRASTRUCTURE_PLACEMENTS.find(
      (p) => p.id === (obj.userData.runtimeSourcePlacement ?? id),
    );
    if (!site) return;
    this.infrastructure.roots.push(obj);
    obj.userData.campObject.label = site.label;
    if (site.modelKey === 'festivalGate' || site.modelKey === 'waterCurtain') {
      // A portal must remain passable: only block its low, upright supports.
      obj.traverse((part) => {
        const node = String(part.userData.runtimeNode ?? part.name);
        if (part instanceof THREE.Mesh && /Tower_Banner|Pillar|Vertical_Post/.test(node))
          this.boxCollider(new THREE.Box3().setFromObject(part));
      });
    } else if (site.colliderSize && site.modelKey !== 'fieldShowers') this.boxCollider(box);
    if (site.grassMaskRadius) this.grassExclusions.push(box);
    if (site.modelKey === 'toitoiRow') {
      obj.userData.authoredDynamic = true;
      obj.traverse((part) => {
        const node = String(part.userData.runtimeNode ?? part.name);
        if (!/^ToiToi_Door_\d+$/.test(node)) return;
        const doorId = `${id}_${node}`;
        part.userData.interactionRoot = part;
        part.userData.interaction = { kind: 'toitoi_door', doorId };
        enableInteractionLayer(part);
        this.infrastructure.toiToiDoors.registerDoor({
          id: doorId,
          label: 'Drzwi TOI TOI',
          interactionMesh: part,
          doorWing: part,
          baseRotationY: part.rotation.y,
        });
        this.interactables.push({ object: part, action: 'toitoi_door', doorId, label: 'Drzwi TOI TOI' });
      });
    }
    if (site.modelKey === 'fieldShowers') {
      const hitbox = this.trigger(obj, 'field_shower', 'Umyj się pod prysznicem');
      hitbox.name = id;
      this.infrastructure.showerTriggers.push(hitbox);
      this.interactables.push({
        object: hitbox,
        action: 'field_shower',
        showerId: id,
        label: 'Umyj się pod prysznicem',
      });
    }
    if (site.modelKey === 'grzybek') {
      const particles = new GrzybekWaterParticles(500);
      particles.points.position.set(center.x, box.min.y, center.z);
      this.root.add(particles.points);
      this.infrastructure.grzybekParticles = particles;
    }
  }

  private bindWheel() {
    const root = this.placements.get('AllegroWheel');
    if (!root) return;
    let rotor: THREE.Object3D | undefined;
    root.traverse((obj) => {
      if (obj.userData.wheelPart === 'rotor') rotor = obj;
    });
    if (!rotor) throw new Error('Authored Allegro wheel has no rotor metadata');
    const gondolas = rotor.children.filter((obj) => obj.userData.wheelPart === 'gondola');
    if (gondolas.length !== 24) throw new Error('Authored Allegro wheel must have 24 gondolas');
    root.userData.authoredDynamic = true;
    const collider = new THREE.Box3().setFromObject(root);
    this.wheel = new FestivalWheel(root, collider, rotor, gondolas);
    this.boxCollider(collider);
    const hitbox = this.trigger(root, 'ferris_wheel', 'Przejedź się kołem widokowym [E]');
    const center = collider.getCenter(new THREE.Vector3());
    // Place the station outside the solid wheel collider, not inside its footprint.
    hitbox.position.set(center.x, 1.5, collider.max.z + 2);
    hitbox.userData.entryRadius = 3;
    root.userData.boardingTarget = { x: hitbox.position.x, z: hitbox.position.z };
    const entrance = new THREE.Mesh(
      new THREE.RingGeometry(0.65, 0.9, 32),
      new THREE.MeshBasicMaterial({ color: 0xb2ff45, side: THREE.DoubleSide }),
    );
    entrance.name = 'AllegroBoardingStation';
    entrance.rotation.x = -Math.PI / 2;
    entrance.position.set(hitbox.position.x, 0.04, hitbox.position.z);
    this.root.add(entrance);
    this.interactables.push({
      object: hitbox,
      action: 'ferris_wheel',
      label: 'Przejedź się kołem widokowym [E]',
    });
  }

  private bindPatrolGates() {
    const barriers = [...this.placements.entries()]
      .filter(([id]) => id.startsWith('StageBarrier_'))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, obj]) => obj);
    if (barriers.length < 2) return;
    // Export order follows the arc. Large neighbour gaps are exactly the three entrances.
    let number = 0;
    for (let i = 1; i < barriers.length; i++) {
      const a = barriers[i - 1].getWorldPosition(new THREE.Vector3());
      const b = barriers[i].getWorldPosition(new THREE.Vector3());
      if (a.distanceTo(b) < 5) continue;
      const hitbox = new THREE.Mesh(
        new THREE.BoxGeometry(4, 2.5, 4),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }),
      );
      hitbox.position.copy(a.add(b).multiplyScalar(0.5));
      hitbox.position.y = 1.25;
      hitbox.name = `patrol_checkpoint_authored_${number++}`;
      hitbox.userData.interactionRoot = hitbox;
      hitbox.userData.interaction = { kind: 'patrol_checkpoint' };
      this.root.add(hitbox);
      enableInteractionLayer(hitbox);
      this.infrastructure.patrolCheckpoints.push(hitbox);
      this.interactables.push({
        object: hitbox,
        action: 'patrol_checkpoint',
        label: 'Kontrola Pokojowego Patrolu — Duża Scena',
      });
    }
  }

  /** Share draw calls for repeated scenery, but never batch animated or interactive nodes. */
  private batchStaticMeshes() {
    const buckets = new Map<string, THREE.Mesh[]>();
    this.root.updateMatrixWorld(true);
    this.root.traverse((obj) => {
      if (
        !(obj instanceof THREE.Mesh) ||
        obj instanceof THREE.InstancedMesh ||
        obj instanceof THREE.SkinnedMesh
      )
        return;
      let parent: THREE.Object3D | null = obj;
      while (parent) {
        if (
          parent.userData.authoredDynamic ||
          parent.userData.interaction ||
          parent.name.startsWith('InteractionHitbox')
        )
          return;
        parent = parent.parent;
      }
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      const position = obj.getWorldPosition(new THREE.Vector3());
      const cell = `${Math.floor(position.x / 32)},${Math.floor(position.z / 32)}`;
      const key = `${cell}:${obj.geometry.uuid}:${materials.map((m) => m.uuid).join(',')}`;
      const bucket = buckets.get(key) ?? [];
      bucket.push(obj);
      buckets.set(key, bucket);
    });
    const inverse = this.root.matrixWorld.clone().invert();
    const mergeBuckets = new Map<string, THREE.Mesh[]>();
    for (const meshes of buckets.values()) {
      if (meshes.length < 2) {
        const mesh = meshes[0];
        if (Array.isArray(mesh.material) || mesh.material.transparent) continue;
        const position = mesh.getWorldPosition(new THREE.Vector3());
        const attributes = Object.entries(mesh.geometry.attributes)
          .map(([name, attribute]) => `${name}:${attribute.itemSize}:${attribute.normalized}`)
          .sort()
          .join(',');
        const key = `${Math.floor(position.x / 32)},${Math.floor(position.z / 32)}:${mesh.material.uuid}:${attributes}:${Boolean(mesh.geometry.index)}`;
        const group = mergeBuckets.get(key) ?? [];
        group.push(mesh);
        mergeBuckets.set(key, group);
        continue;
      }
      const first = meshes[0];
      const batch = new THREE.InstancedMesh(first.geometry, first.material, meshes.length);
      batch.name = `AuthoredBatch_${first.name}`;
      meshes.forEach((mesh, index) => {
        batch.setMatrixAt(index, inverse.clone().multiply(mesh.matrixWorld));
        mesh.visible = false;
      });
      batch.castShadow = true;
      batch.receiveShadow = true;
      batch.computeBoundingSphere();
      this.root.add(batch);
    }
    // Unique truss parts otherwise require thousands of separate draw calls.
    // Merge only compatible opaque meshes in small cells; animated parts stay untouched.
    for (const meshes of mergeBuckets.values()) {
      if (meshes.length < 2) continue;
      const geometries = meshes.map((mesh) =>
        mesh.geometry.clone().applyMatrix4(inverse.clone().multiply(mesh.matrixWorld)),
      );
      const geometry = mergeGeometries(geometries, false);
      geometries.forEach((g) => g.dispose());
      if (!geometry) continue;
      const merged = new THREE.Mesh(geometry, meshes[0].material);
      merged.name = `AuthoredMerged_${meshes[0].name}`;
      merged.castShadow = true;
      merged.receiveShadow = true;
      geometry.computeBoundingSphere();
      meshes.forEach((mesh) => {
        mesh.visible = false;
      });
      this.root.add(merged);
    }
  }
}
