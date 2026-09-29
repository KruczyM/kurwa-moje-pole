import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { GRZYBEK_SITE, GrzybekWaterParticles } from './festivalGrzybek';
import { ToiToiDoorController } from '../interactions/ToiToiDoorController';

export type FestivalInfrastructureModels = {
  festivalGate?: GLTF | null;
  festivalSignpost?: GLTF | null;
  fohTower?: GLTF | null;
  delayTower?: GLTF | null;
  mudBath?: GLTF | null;
  fireTruckOsp?: GLTF | null;
  waterCurtain?: GLTF | null;
  patrolTent?: GLTF | null;
  krishnaVillage?: GLTF | null;
  trashCorral?: GLTF | null;
  grzybek?: GLTF | null;
  washTaps?: GLTF | null;
  toitoiRow?: GLTF | null;
  fieldShowers?: GLTF | null;
  crowdBarrier?: GLTF | null;
  festivalFoodTent?: GLTF | null;
  foodtruckFrytki?: GLTF | null;
  foodtruckChurros?: GLTF | null;
  foodtruckBurger?: GLTF | null;
  foodtruckMakarun?: GLTF | null;
  rollbarLech?: GLTF | null;
};

export type LandmarkPlacement = {
  id: string;
  modelKey: keyof FestivalInfrastructureModels;
  label: string;
  x: number;
  z: number;
  rotationY: number;
  colliderSize?: [number, number, number]; // width, height, depth
  colliderOffset?: [number, number, number];
  grassMaskRadius?: number;
};

export const FESTIVAL_INFRASTRUCTURE_PLACEMENTS: LandmarkPlacement[] = [
  // 1. Monumental Main Entrance Gate
  {
    id: 'festival_gate_main',
    modelKey: 'festivalGate',
    label: 'Brama Festiwalowa — Główne Wejście',
    x: 0,
    z: -68,
    rotationY: 0,
    // Portals allow walking through middle, collider on left/right towers
    colliderSize: [18.0, 9.5, 4.0],
    grassMaskRadius: 9.0,
  },
  // 2. Directional Signposts
  {
    id: 'signpost_camp_crossroads',
    modelKey: 'festivalSignpost',
    label: 'Drogowskaz Festiwalowy — Skrzyżowanie Obozowe',
    x: 14,
    z: -25,
    rotationY: -0.4,
    colliderSize: [0.8, 4.2, 0.8],
  },
  {
    id: 'signpost_stage_avenue',
    modelKey: 'festivalSignpost',
    label: 'Drogowskaz Festiwalowy — Aleja Scen',
    x: 48,
    z: 28,
    rotationY: 0.8,
    colliderSize: [0.8, 4.2, 0.8],
  },
  // 3. FOH Sound & Lighting Tower
  {
    id: 'foh_tower_main',
    modelKey: 'fohTower',
    label: 'Wieża FOH — Reżyseria Dużej Sceny',
    x: 72,
    z: 18,
    rotationY: -Math.PI / 2,
    colliderSize: [6.5, 6.0, 4.8],
    grassMaskRadius: 3.5,
  },
  // 4. Delay Speaker Towers (North & South Field)
  {
    id: 'delay_tower_north',
    modelKey: 'delayTower',
    label: 'Wieża Nagłośnieniowa Delay (Północ)',
    x: 54,
    z: -4,
    rotationY: -Math.PI / 2,
    colliderSize: [4.0, 11.5, 4.0],
    grassMaskRadius: 2.5,
  },
  {
    id: 'delay_tower_south',
    modelKey: 'delayTower',
    label: 'Wieża Nagłośnieniowa Delay (Południe)',
    x: 54,
    z: 40,
    rotationY: -Math.PI / 2,
    colliderSize: [4.0, 11.5, 4.0],
    grassMaskRadius: 2.5,
  },
  // 5. Mud Bath & OSP Fire Truck
  {
    id: 'mud_bath_pit',
    modelKey: 'mudBath',
    label: 'Kąpiel Błotna — Tradycyjna Ochłoda',
    x: 64,
    z: -12,
    rotationY: 0.1,
    grassMaskRadius: 4.8,
  },
  {
    id: 'fire_truck_czaplinek',
    modelKey: 'fireTruckOsp',
    label: 'Wóz Bojowy OSP Czaplinek',
    x: 64,
    z: -19,
    rotationY: 0,
    colliderSize: [3.2, 3.4, 8.2],
    grassMaskRadius: 4.0,
  },
  // 6. Water Curtain (Kurtyna Wodna)
  {
    id: 'water_curtain_avenue',
    modelKey: 'waterCurtain',
    label: 'Kurtyna Wodna — Pasaż Główny',
    x: 50,
    z: -35,
    rotationY: Math.PI / 2,
    grassMaskRadius: 3.0,
  },
  // 7. Pokojowy Patrol & Medical Aid Tent
  {
    id: 'patrol_tent_main',
    modelKey: 'patrolTent',
    label: 'Pokojowy Patrol — Punkt Medyczny & Info',
    x: -24,
    z: -25,
    rotationY: 0,
    colliderSize: [4.4, 3.8, 4.4],
    grassMaskRadius: 2.8,
  },
  // 8. Hare Krishna Village Tent
  {
    id: 'krishna_village_tent',
    modelKey: 'krishnaVillage',
    label: 'Wioska Kryszny — Kuchnia i Strefa Pokoju',
    x: -88,
    z: 28,
    rotationY: Math.PI / 2,
    colliderSize: [10.5, 5.0, 7.5],
    grassMaskRadius: 6.0,
  },
  // 9. Eco Waste Corrals ("Zaraz Będzie Czysto")
  {
    id: 'trash_corral_market',
    modelKey: 'trashCorral',
    label: 'Eko Zagroda Odpadów — Pasaż Handlowy',
    x: -12,
    z: -26,
    rotationY: 0,
    colliderSize: [4.8, 1.8, 3.2],
    grassMaskRadius: 2.6,
  },
  {
    id: 'trash_corral_field',
    modelKey: 'trashCorral',
    label: 'Eko Zagroda Odpadów — Pole Koncertowe',
    x: 44,
    z: 4,
    rotationY: -Math.PI / 2,
    colliderSize: [4.8, 1.8, 3.2],
    grassMaskRadius: 2.6,
  },
  // 10. Sanitary Blocks: TOI TOI Battery & Wash Stations
  {
    id: 'toitoi_battery_camp',
    modelKey: 'toitoiRow',
    label: 'Bateria Kabin TOI TOI — Sektor Obozowy',
    x: 20,
    z: -50,
    rotationY: 0,
    colliderSize: [8.0, 2.5, 2.2],
    grassMaskRadius: 4.2,
  },
  {
    id: 'wash_taps_camp',
    modelKey: 'washTaps',
    label: 'Krany Festiwalowe — Sektor Obozowy',
    x: 28,
    z: -50,
    rotationY: 0,
    colliderSize: [6.5, 2.6, 2.6],
    grassMaskRadius: 3.5,
  },
  {
    id: 'toitoi_battery_west',
    modelKey: 'toitoiRow',
    label: 'Bateria Kabin TOI TOI — Sektor Zachodni',
    x: -60,
    z: 10,
    rotationY: Math.PI / 2,
    colliderSize: [2.2, 2.5, 8.0],
    grassMaskRadius: 4.2,
  },
  {
    id: 'wash_taps_west',
    modelKey: 'washTaps',
    label: 'Krany Festiwalowe — Sektor Zachodni',
    x: -60,
    z: 18,
    rotationY: Math.PI / 2,
    colliderSize: [2.6, 2.6, 6.5],
    grassMaskRadius: 3.5,
  },
  // Second distant sanitary hub near camps
  {
    id: 'toitoi_battery_south',
    modelKey: 'toitoiRow',
    label: 'Bateria Kabin TOI TOI — Sektor Południowy',
    x: -30,
    z: -70,
    rotationY: 0,
    colliderSize: [8.0, 2.5, 2.2],
    grassMaskRadius: 4.2,
  },
  {
    id: 'wash_taps_south',
    modelKey: 'washTaps',
    label: 'Krany Festiwalowe — Sektor Południowy',
    x: -22,
    z: -70,
    rotationY: 0,
    colliderSize: [6.5, 2.6, 2.6],
    grassMaskRadius: 3.5,
  },
  // 11. Grzybek Wodny — relocated in front left of Duża Scena
  {
    id: 'festival_grzybek',
    modelKey: 'grzybek',
    label: 'Grzybek Wodny — Chłodzenie i Zabawa',
    x: GRZYBEK_SITE.x,
    z: GRZYBEK_SITE.z,
    rotationY: 0,
    colliderSize: [0.7, 4.2, 0.7],
    grassMaskRadius: 6.0,
  },
  // 12. Gastro Zone — Paired Large White Food Tents on South Passage
  {
    id: 'food_tent_south_1',
    modelKey: 'festivalFoodTent',
    label: 'Hala Gastronomiczna — Pasaż Południowy 1',
    x: -70,
    z: 86,
    rotationY: 0,
    colliderSize: [26.0, 5.0, 10.0],
    grassMaskRadius: 14.0,
  },
  {
    id: 'food_tent_south_2',
    modelKey: 'festivalFoodTent',
    label: 'Hala Gastronomiczna — Pasaż Południowy 2',
    x: -36,
    z: 86,
    rotationY: 0,
    colliderSize: [26.0, 5.0, 10.0],
    grassMaskRadius: 14.0,
  },
  // 13. Gastro Zone — Paired Large White Food Tents on North Passage
  {
    id: 'food_tent_north_1',
    modelKey: 'festivalFoodTent',
    label: 'Hala Gastronomiczna — Pasaż Północny 1',
    x: -38,
    z: -52,
    rotationY: Math.PI,
    colliderSize: [26.0, 5.0, 10.0],
    grassMaskRadius: 14.0,
  },
  {
    id: 'food_tent_north_2',
    modelKey: 'festivalFoodTent',
    label: 'Hala Gastronomiczna — Pasaż Północny 2',
    x: -4,
    z: -52,
    rotationY: Math.PI,
    colliderSize: [26.0, 5.0, 10.0],
    grassMaskRadius: 14.0,
  },
  // 14. Foodtrucks & Rollbars
  {
    id: 'foodtruck_frytki_south',
    modelKey: 'foodtruckFrytki',
    label: 'Foodtruck Frytki Belgijskie',
    x: -88,
    z: 86,
    rotationY: 0,
    colliderSize: [6.5, 3.2, 2.6],
    grassMaskRadius: 3.5,
  },
  {
    id: 'rollbar_lech_south',
    modelKey: 'rollbarLech',
    label: 'Rollbar Piwo Lech — Pasaż Południowy',
    x: -18,
    z: 86,
    rotationY: 0,
    colliderSize: [4.8, 3.0, 2.8],
    grassMaskRadius: 2.8,
  },
  {
    id: 'foodtruck_burger_north',
    modelKey: 'foodtruckBurger',
    label: 'Foodtruck Smash Burger & Zapiekanki',
    x: -56,
    z: -52,
    rotationY: Math.PI,
    colliderSize: [6.5, 3.2, 2.6],
    grassMaskRadius: 3.5,
  },
  {
    id: 'rollbar_lech_north',
    modelKey: 'rollbarLech',
    label: 'Rollbar Piwo Lech — Pasaż Północny',
    x: -21,
    z: -52,
    rotationY: Math.PI,
    colliderSize: [4.8, 3.0, 2.8],
    grassMaskRadius: 2.8,
  },
  {
    id: 'foodtruck_churros_north',
    modelKey: 'foodtruckChurros',
    label: 'Foodtruck Gorące Churros',
    x: 14,
    z: -52,
    rotationY: Math.PI,
    colliderSize: [6.5, 3.2, 2.6],
    grassMaskRadius: 3.5,
  },
  {
    id: 'foodtruck_makarun_north',
    modelKey: 'foodtruckMakarun',
    label: 'Foodtruck Makarun Spaghetti Bar',
    x: 32,
    z: -52,
    rotationY: Math.PI,
    colliderSize: [6.5, 3.2, 2.6],
    grassMaskRadius: 3.5,
  },
  // 15. Pokojowy Patrol Checkpoint Station near Duża Scena entrance
  {
    id: 'patrol_tent_stage',
    modelKey: 'patrolTent',
    label: 'Pokojowy Patrol — Posterunek Duża Scena',
    x: 104,
    z: 24,
    rotationY: -Math.PI / 2,
    colliderSize: [4.4, 3.8, 4.4],
    grassMaskRadius: 3.0,
  },
];

export class FestivalInfrastructureInstance {
  public grzybekParticles: GrzybekWaterParticles | null = null;
  public colliders: THREE.Box3[] = [];
  public roots: THREE.Object3D[] = [];
  public toiToiDoors: ToiToiDoorController = new ToiToiDoorController();
  public showerTriggers: THREE.Object3D[] = [];
  public patrolCheckpoints: THREE.Object3D[] = [];

  public update(delta: number): void {
    if (this.grzybekParticles) {
      this.grzybekParticles.update(delta);
    }
    this.toiToiDoors.update(delta);
  }

  public dispose(): void {
    if (this.grzybekParticles) {
      this.grzybekParticles.dispose();
      this.grzybekParticles = null;
    }
    this.toiToiDoors.dispose();
    this.showerTriggers.length = 0;
    this.patrolCheckpoints.length = 0;
  }
}

export function sampleInfrastructureGrassMask(x: number, z: number): number {
  let mask = 1.0;
  for (const item of FESTIVAL_INFRASTRUCTURE_PLACEMENTS) {
    if (!item.grassMaskRadius) continue;
    const dx = x - item.x;
    const dz = z - item.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const rad = item.grassMaskRadius;
    const step = THREE.MathUtils.smoothstep(dist - rad, 0, 0.4);
    mask = Math.min(mask, step);
  }
  return mask;
}

export function placeFestivalInfrastructure(
  parent: THREE.Object3D,
  models: FestivalInfrastructureModels,
  heightAt: (x: number, z: number) => number,
): FestivalInfrastructureInstance {
  const instance = new FestivalInfrastructureInstance();

  for (const site of FESTIVAL_INFRASTRUCTURE_PLACEMENTS) {
    const gltf = models[site.modelKey];
    if (!gltf) continue;

    const root = clone(gltf.scene);
    root.name = `Festival_${site.id}`;
    root.userData.campObject = { id: site.id, label: site.label };
    root.userData.exteriorOnly = true;

    const floor = heightAt(site.x, site.z);
    root.position.set(site.x, floor, site.z);
    root.rotation.y = site.rotationY;

    root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });

    parent.add(root);
    instance.roots.push(root);

    // Colliders
    if (site.modelKey === 'waterCurtain') {
      const pillarRadius = 0.55;
      const pillarHeight = 4.2;
      for (const localOffset of [-2.6, 2.6]) {
        const pillarPos = new THREE.Vector3(localOffset, 0, 0).applyAxisAngle(
          new THREE.Vector3(0, 1, 0),
          site.rotationY,
        );
        const px = site.x + pillarPos.x;
        const pz = site.z + pillarPos.z;
        instance.colliders.push(
          new THREE.Box3(
            new THREE.Vector3(px - pillarRadius, floor - 1.0, pz - pillarRadius),
            new THREE.Vector3(px + pillarRadius, floor + pillarHeight, pz + pillarRadius),
          ),
        );
      }
    } else if (site.colliderSize) {
      const [w, h, d] = site.colliderSize;
      const c = Math.abs(Math.cos(site.rotationY));
      const s = Math.abs(Math.sin(site.rotationY));
      const halfX = (w * c + d * s) / 2;
      const halfZ = (w * s + d * c) / 2;

      const box = new THREE.Box3(
        new THREE.Vector3(site.x - halfX, floor - 1.0, site.z - halfZ),
        new THREE.Vector3(site.x + halfX, floor + h, site.z + halfZ),
      );
      instance.colliders.push(box);
    }


    // Door registration for ToiToi row
    if (site.modelKey === 'toitoiRow') {
      for (let i = 0; i < 6; i++) {
        const doorWing = root.getObjectByName(`ToiToi_Door_${i}`);
        if (doorWing) {
          instance.toiToiDoors.registerDoor({
            id: `${site.id}_door_${i}`,
            label: `Drzwi TOI TOI #${i + 1}`,
            interactionMesh: doorWing,
            doorWing: doorWing,
            baseRotationY: doorWing.rotation.y,
            openAngle: Math.PI * 0.52,
          });
        }
      }
    }

    // Shower triggers
    if (site.modelKey === 'fieldShowers') {
      const trigger = new THREE.Object3D();
      trigger.name = site.id;
      trigger.position.set(site.x, floor + 1.2, site.z);
      parent.add(trigger);
      instance.showerTriggers.push(trigger);
    }

    // Attach Grzybek particles if placing water mushroom
    if (site.modelKey === 'grzybek') {
      const particles = new GrzybekWaterParticles(500);
      particles.points.position.set(site.x, floor, site.z);
      parent.add(particles.points);
      instance.grzybekParticles = particles;
    }
  }

  // Stage Barrier Perimeter Fence around Duża Scena (x: 110..194, z: -14..50)
  // Front line at x = 110 with central gate at z: 14..22
  const barrierModel = models.crowdBarrier;
  const barrierRoot = new THREE.Group();
  barrierRoot.name = 'MainStage_Barrier_Perimeter';
  parent.add(barrierRoot);
  instance.roots.push(barrierRoot);

  const placeBarrierSegment = (px: number, pz: number, rotY: number) => {
    if (!barrierModel) return;
    const barrier = clone(barrierModel.scene);
    const bf = heightAt(px, pz);
    barrier.position.set(px, bf, pz);
    barrier.rotation.y = rotY;
    barrier.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    barrierRoot.add(barrier);
  };

  // 1. Front West Fence: x = 110, z in [-14, 14]
  for (let z = -13; z <= 13; z += 2.5) {
    placeBarrierSegment(110, z, Math.PI / 2);
  }
  // 2. Front West Fence: x = 110, z in [22, 50]
  for (let z = 23; z <= 49; z += 2.5) {
    placeBarrierSegment(110, z, Math.PI / 2);
  }
  // 3. North Side Fence: z = -14, x in [110, 194]
  for (let x = 111.5; x <= 193; x += 2.5) {
    placeBarrierSegment(x, -14, 0);
  }
  // 4. South Side Fence: z = 50, x in [110, 194]
  for (let x = 111.5; x <= 193; x += 2.5) {
    placeBarrierSegment(x, 50, 0);
  }

  // Barrier Colliders: 4 wall sections (leaving gate at x = 110, z: [14, 22] open)
  const baseFloor = heightAt(110, 18);
  instance.colliders.push(
    new THREE.Box3(new THREE.Vector3(109.2, baseFloor - 1, -14), new THREE.Vector3(110.8, baseFloor + 2.5, 14)),
    new THREE.Box3(new THREE.Vector3(109.2, baseFloor - 1, 22), new THREE.Vector3(110.8, baseFloor + 2.5, 50)),
    new THREE.Box3(new THREE.Vector3(110, baseFloor - 1, -14.8), new THREE.Vector3(194, baseFloor + 2.5, -13.2)),
    new THREE.Box3(new THREE.Vector3(110, baseFloor - 1, 49.2), new THREE.Vector3(194, baseFloor + 2.5, 50.8)),
  );

  // Pokojowy Patrol checkpoint trigger at central gate entrance (x: 109.5, z: 18)
  const checkpoint = new THREE.Object3D();
  checkpoint.name = 'patrol_checkpoint_main_stage';
  const gateFloor = heightAt(109.5, 18);
  checkpoint.position.set(109.5, gateFloor + 1.0, 18);
  checkpoint.userData.interaction = {
    kind: 'patrol_checkpoint',
    label: 'Kontrola Pokojowego Patrolu: Zakaz wnoszenia alkoholu i szkła',
  };
  const checkpointHitbox = new THREE.Mesh(
    new THREE.BoxGeometry(3.0, 2.5, 6.0),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  checkpointHitbox.name = 'InteractionHitbox_PatrolCheckpoint';
  checkpoint.add(checkpointHitbox);
  checkpoint.traverse((child) => (child.userData.interactionRoot = checkpoint));
  parent.add(checkpoint);
  instance.patrolCheckpoints.push(checkpoint);

  return instance;
}
