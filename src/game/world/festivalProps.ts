import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { DEFAULT_FESTIVAL_CANS } from '../interactions/CanCollector';

export interface PropModelSources {
  beerCan?: GLTF | null;
  festivalChair?: GLTF | null;
  acousticGuitar?: GLTF | null;
  coolerBox?: GLTF | null;
  festivalBackpack?: GLTF | null;
  trashBagsPile?: GLTF | null;
  campingStove?: GLTF | null;
  waterJug5L?: GLTF | null;
  beerCrate?: GLTF | null;
  campTableMessy?: GLTF | null;
  campFlagTotem?: GLTF | null;
  tarpCanopy?: GLTF | null;
  beerBenchTable?: GLTF | null;
  palletSeating?: GLTF | null;
  campClothesline?: GLTF | null;
  disposableBbq?: GLTF | null;
  gastroUmbrella?: GLTF | null;
}

export type PropType =
  | 'beerCan'
  | 'festivalChair'
  | 'acousticGuitar'
  | 'coolerBox'
  | 'festivalBackpack'
  | 'trashBagsPile'
  | 'campingStove'
  | 'waterJug5L'
  | 'beerCrate'
  | 'campTableMessy'
  | 'campFlagTotem'
  | 'tarpCanopy'
  | 'beerBenchTable'
  | 'palletSeating'
  | 'campClothesline'
  | 'disposableBbq'
  | 'gastroUmbrella';

export interface PropPlacement {
  id: string;
  type: PropType;
  position: [number, number, number]; // [x, y, z]
  rotation?: [number, number, number]; // [rotX, rotY, rotZ]
  scaleMultiplier?: number;
  label: string;
}

/** Standard real-world heights (meters) for auto-scaling normalized GLB models */
export const PROP_TARGET_HEIGHTS: Record<PropType, number> = {
  beerCan: 0.16, // Puszka 500ml
  acousticGuitar: 0.98, // Gitara akustyczna 4/4
  coolerBox: 0.38, // Turystyczna lodówka pasywna
  festivalBackpack: 0.65, // Plecak wyprawowy 65L
  festivalChair: 0.82, // Składane krzesełko turystyczne
  trashBagsPile: 0.75, // Sterta worków na śmieci
  campingStove: 0.32, // Kuchenka turystyczna z menażką
  waterJug5L: 0.36, // Baniak z wodą 5L
  beerCrate: 0.32, // Skrzynka z piwem
  campTableMessy: 0.72, // Składany stolik kempingowy z kubkami i radiem
  campFlagTotem: 3.4, // Maszt obozowy / totem z flagą
  tarpCanopy: 2.1, // Zadaszenie z plandeki
  beerBenchTable: 0.76, // Zestaw biesiadny (stół + ławki)
  palletSeating: 0.7, // Kanapa z europalet z poduchami
  campClothesline: 1.45, // Linka na pranie z ręcznikami
  disposableBbq: 0.3, // Grill jednorazowy z kiełbaskami
  gastroUmbrella: 2.65, // Parasol gastronomiczny przeciwsłoneczny
};

/**
 * Autentyczne lokacje rekwizytów na terenie obozu festiwalowego i strefy Flanki
 */
export const FESTIVAL_PROP_PLACEMENTS: readonly PropPlacement[] = [
  // --- Rejon Ogniska i Chilloutu ---
  {
    id: 'guitar_campfire',
    type: 'acousticGuitar',
    position: [4.85, 0, -2.4],
    rotation: [-0.35, 0.4, 0.2],
    label: 'Gitara akustyczna przy ognisku',
  },
  {
    id: 'can_campfire_log',
    type: 'beerCan',
    position: [4.55, 0, -2.0],
    rotation: [0, 0.8, 0],
    label: 'Puszka piwa przy ognisku',
  },
  {
    id: 'backpack_campfire',
    type: 'festivalBackpack',
    position: [6.35, 0, -3.8],
    rotation: [0, -0.6, 0],
    label: 'Plecak festiwalowy przy ognisku',
  },
  {
    id: 'cooler_campfire',
    type: 'coolerBox',
    position: [6.7, 0, -2.5],
    rotation: [0, 0.3, 0],
    label: 'Lodówka turystyczna przy ognisku',
  },
  {
    id: 'chair_campfire',
    type: 'festivalChair',
    position: [3.6, 0, -2.6],
    rotation: [0, 1.25, 0],
    label: 'Składane krzesło przy ognisku',
  },

  // --- Strefa Obozu Mad Dog i Centralny Stół ---
  {
    id: 'cooler_camp_table',
    type: 'coolerBox',
    position: [1.3, 0, 0.45],
    rotation: [0, -0.4, 0],
    label: 'Lodówka przy stole obozowym',
  },
  {
    id: 'chair_chillout_edge',
    type: 'festivalChair',
    position: [2.8, 0, -4.2],
    rotation: [0, 0.5, 0],
    label: 'Krzesełko turystyczne na skraju obozu',
  },
  {
    id: 'backpack_tent_t20',
    type: 'festivalBackpack',
    position: [4.2, 0, 4.0],
    rotation: [0, 1.1, 0],
    label: 'Plecak przed namiotem T20',
  },
  {
    id: 'backpack_tent_west',
    type: 'festivalBackpack',
    position: [-3.8, 0, 3.5],
    rotation: [0, -0.9, 0],
    label: 'Plecak przed zachodnim namiotem',
  },

  // --- Boisko do Flanek (Tradycja Woodstock / Pol'and'Rock) ---
  {
    id: 'flanki_center_can',
    type: 'beerCan',
    position: [0.0, 0, -12.0],
    rotation: [0, 0, 0],
    label: 'Puszka centralna w meczu Flanek',
  },
  {
    id: 'flanki_team_a_can',
    type: 'beerCan',
    position: [-3.0, 0, -12.0],
    rotation: [0, 0.5, 0],
    label: 'Puszka drużyny lewej (Flanki)',
  },
  {
    id: 'flanki_team_b_can',
    type: 'beerCan',
    position: [3.0, 0, -12.0],
    rotation: [0, -0.5, 0],
    label: 'Puszka drużyny prawej (Flanki)',
  },
  {
    id: 'flanki_spectator_chair_1',
    type: 'festivalChair',
    position: [-1.2, 0, -13.5],
    rotation: [0, 0.2, 0],
    label: 'Krzesło kibica Flanek A',
  },
  {
    id: 'flanki_spectator_chair_2',
    type: 'festivalChair',
    position: [1.2, 0, -13.5],
    rotation: [0, -0.2, 0],
    label: 'Krzesło kibica Flanek B',
  },
  {
    id: 'flanki_cooler',
    type: 'coolerBox',
    position: [-1.8, 0, -13.6],
    rotation: [0, 0.1, 0],
    label: 'Lodówka z piwem dla zawodników Flanek',
  },

  // --- Worki na śmieci (Pola namiotowe i strefa gastro) ---
  {
    id: 'trash_pile_main_camp_edge',
    type: 'trashBagsPile',
    position: [7.2, 0, 5.5],
    rotation: [0, 0.4, 0],
    label: 'Sterta worków na śmieci przy głównym obozie',
  },
  {
    id: 'trash_pile_flanki_boundary',
    type: 'trashBagsPile',
    position: [-4.5, 0, -15.2],
    rotation: [0, -0.7, 0],
    label: 'Worki na puszki i śmieci przy boisku Flanek',
  },
  {
    id: 'trash_pile_east_camp',
    type: 'trashBagsPile',
    position: [24.0, 0, 3.2],
    rotation: [0, 1.2, 0],
    label: 'Worki na śmieci obozu wschodniego',
  },
  {
    id: 'trash_pile_west_camp',
    type: 'trashBagsPile',
    position: [-22.5, 0, 4.0],
    rotation: [0, -0.3, 0],
    label: 'Worki na śmieci obozu zachodniego',
  },
  {
    id: 'trash_pile_gastro_east',
    type: 'trashBagsPile',
    position: [18.5, 0, -48.0],
    rotation: [0, 0.9, 0],
    label: 'Worki na odpady przy strefie gastro wschodniej',
  },
  {
    id: 'trash_pile_gastro_west',
    type: 'trashBagsPile',
    position: [-19.2, 0, -47.5],
    rotation: [0, -1.1, 0],
    label: 'Worki na odpady przy strefie gastro zachodniej',
  },
  {
    id: 'trash_pile_market_north',
    type: 'trashBagsPile',
    position: [12.0, 0, 34.0],
    rotation: [0, 0.2, 0],
    label: 'Worki na śmieci przy alei handlowej',
  },

  // --- Strefa Gastro i Biesiadna: Ławostoły i Parasole ---
  {
    id: 'beer_bench_gastro_1',
    type: 'beerBenchTable',
    position: [-14.0, 0, -52.0],
    rotation: [0, 0.1, 0],
    label: 'Ławostół gastronomiczny zachodni 1',
  },
  {
    id: 'beer_bench_gastro_2',
    type: 'beerBenchTable',
    position: [-14.0, 0, -56.0],
    rotation: [0, 0.0, 0],
    label: 'Ławostół gastronomiczny zachodni 2',
  },
  {
    id: 'beer_bench_gastro_3',
    type: 'beerBenchTable',
    position: [-8.5, 0, -52.0],
    rotation: [0, -0.05, 0],
    label: 'Ławostół gastronomiczny zachodni 3',
  },
  {
    id: 'beer_bench_gastro_4',
    type: 'beerBenchTable',
    position: [-8.5, 0, -56.0],
    rotation: [0, 0.12, 0],
    label: 'Ławostół gastronomiczny zachodni 4',
  },
  {
    id: 'beer_bench_gastro_5',
    type: 'beerBenchTable',
    position: [8.5, 0, -52.0],
    rotation: [0, 0.05, 0],
    label: 'Ławostół gastronomiczny wschodni 1',
  },
  {
    id: 'beer_bench_gastro_6',
    type: 'beerBenchTable',
    position: [8.5, 0, -56.0],
    rotation: [0, -0.08, 0],
    label: 'Ławostół gastronomiczny wschodni 2',
  },
  {
    id: 'beer_bench_gastro_7',
    type: 'beerBenchTable',
    position: [14.0, 0, -52.0],
    rotation: [0, 0.0, 0],
    label: 'Ławostół gastronomiczny wschodni 3',
  },
  {
    id: 'beer_bench_gastro_8',
    type: 'beerBenchTable',
    position: [14.0, 0, -56.0],
    rotation: [0, 0.15, 0],
    label: 'Ławostół gastronomiczny wschodni 4',
  },
  {
    id: 'beer_bench_plaza_central',
    type: 'beerBenchTable',
    position: [0.0, 0, -54.0],
    rotation: [0, 1.57, 0],
    label: 'Ławostół centralny na placu gastro',
  },
  {
    id: 'umbrella_gastro_w1',
    type: 'gastroUmbrella',
    position: [-11.2, 0, -54.0],
    rotation: [0, 0.3, 0],
    label: 'Parasol gastronomiczny zachodni 1',
  },
  {
    id: 'umbrella_gastro_w2',
    type: 'gastroUmbrella',
    position: [-14.0, 0, -54.0],
    rotation: [0, 0.7, 0],
    label: 'Parasol gastronomiczny zachodni 2',
  },
  {
    id: 'umbrella_gastro_e1',
    type: 'gastroUmbrella',
    position: [11.2, 0, -54.0],
    rotation: [0, -0.4, 0],
    label: 'Parasol gastronomiczny wschodni 1',
  },
  {
    id: 'umbrella_gastro_e2',
    type: 'gastroUmbrella',
    position: [14.0, 0, -54.0],
    rotation: [0, 1.1, 0],
    label: 'Parasol gastronomiczny wschodni 2',
  },
  {
    id: 'umbrella_gastro_center',
    type: 'gastroUmbrella',
    position: [0.0, 0, -51.5],
    rotation: [0, 0.0, 0],
    label: 'Parasol gastronomiczny centralny',
  },

  // --- Obozowe Totemy i Plandeki Przeciwsłoneczne ---
  {
    id: 'flag_totem_main_camp',
    type: 'campFlagTotem',
    position: [2.5, 0, -1.0],
    rotation: [0, 0.6, 0],
    label: 'Totem z flagą: Obóz Główny',
  },
  {
    id: 'flag_totem_east_camp',
    type: 'campFlagTotem',
    position: [16.5, 0, 1.5],
    rotation: [0, -0.8, 0],
    label: 'Maszt z flagą: Wioska Wschodnia',
  },
  {
    id: 'flag_totem_west_camp',
    type: 'campFlagTotem',
    position: [-16.0, 0, 1.0],
    rotation: [0, 0.3, 0],
    label: 'Maszt z flagą: Osada Zachodnia',
  },
  {
    id: 'flag_totem_flanki',
    type: 'campFlagTotem',
    position: [-4.0, 0, -10.5],
    rotation: [0, 1.3, 0],
    label: 'Totem areny Flanek',
  },
  {
    id: 'tarp_canopy_main_camp',
    type: 'tarpCanopy',
    position: [0.8, 0, 3.2],
    rotation: [0, 0.15, 0],
    label: 'Zadaszenie z plandeki przy obozie głównym',
  },
  {
    id: 'tarp_canopy_east_camp',
    type: 'tarpCanopy',
    position: [19.0, 0, 5.0],
    rotation: [0, -0.3, 0],
    label: 'Plandeka przeciwsłoneczna obozu wschodniego',
  },
  {
    id: 'tarp_canopy_west_camp',
    type: 'tarpCanopy',
    position: [-19.5, 0, 4.5],
    rotation: [0, 0.45, 0],
    label: 'Plandeka biwakowa obozu zachodniego',
  },

  // --- Klimat Obozowy: Palety, Kuchenki, Skrzynki, Sznury, Grille ---
  {
    id: 'pallet_seating_campfire',
    type: 'palletSeating',
    position: [5.8, 0, -4.5],
    rotation: [0, -0.5, 0],
    label: 'Kanapa z palet przy ognisku',
  },
  {
    id: 'pallet_seating_chillout',
    type: 'palletSeating',
    position: [-2.5, 0, -2.8],
    rotation: [0, 0.8, 0],
    label: 'Siedzisko paletowe w strefie chillout',
  },
  {
    id: 'pallet_seating_east_camp',
    type: 'palletSeating',
    position: [17.5, 0, -1.5],
    rotation: [0, 0.3, 0],
    label: 'Siedzisko paletowe w obozie wschodnim',
  },
  {
    id: 'clothesline_main_camp',
    type: 'campClothesline',
    position: [-4.2, 0, 6.2],
    rotation: [0, 0.4, 0],
    label: 'Sznur na pranie z ręcznikami i koszulkami',
  },
  {
    id: 'clothesline_east_camp',
    type: 'campClothesline',
    position: [21.5, 0, 7.0],
    rotation: [0, -0.6, 0],
    label: 'Sznur na pranie obozu wschodniego',
  },
  {
    id: 'stove_main_camp',
    type: 'campingStove',
    position: [1.0, 0, 1.2],
    rotation: [0, 0.8, 0],
    label: 'Kuchenka kempingowa z garnkiem (obóz główny)',
  },
  {
    id: 'stove_east_camp',
    type: 'campingStove',
    position: [17.2, 0, 3.8],
    rotation: [0, -0.4, 0],
    label: 'Kuchenka kempingowa (obóz wschodni)',
  },
  {
    id: 'water_jug_main_camp',
    type: 'waterJug5L',
    position: [1.5, 0, 1.1],
    rotation: [0, 0.2, 0],
    label: 'Baniak z wodą 5L (obóz główny)',
  },
  {
    id: 'water_jug_campfire',
    type: 'waterJug5L',
    position: [5.2, 0, -3.2],
    rotation: [0, -0.5, 0],
    label: 'Baniak z wodą przy ognisku',
  },
  {
    id: 'water_jug_west_camp',
    type: 'waterJug5L',
    position: [-17.8, 0, 2.5],
    rotation: [0, 1.1, 0],
    label: 'Baniak z wodą w obozie zachodnim',
  },
  {
    id: 'beer_crate_campfire',
    type: 'beerCrate',
    position: [3.9, 0, -3.4],
    rotation: [0, 0.3, 0],
    label: 'Skrzynka z butelkami piwa przy ognisku',
  },
  {
    id: 'beer_crate_flanki',
    type: 'beerCrate',
    position: [-1.9, 0, -14.2],
    rotation: [0, -0.2, 0],
    label: 'Skrzynka z piwem na boisku do flanek',
  },
  {
    id: 'beer_crate_east_camp',
    type: 'beerCrate',
    position: [18.0, 0, 0.8],
    rotation: [0, 0.7, 0],
    label: 'Skrzynka z piwem w obozie wschodnim',
  },
  {
    id: 'camp_table_messy_main',
    type: 'campTableMessy',
    position: [-0.5, 0, 1.8],
    rotation: [0, 0.1, 0],
    label: 'Składany stolik kempingowy z kubkami i radiem',
  },
  {
    id: 'camp_table_messy_east',
    type: 'campTableMessy',
    position: [16.8, 0, 2.8],
    rotation: [0, -0.5, 0],
    label: 'Stolik kempingowy w obozie wschodnim',
  },
  {
    id: 'bbq_main_camp',
    type: 'disposableBbq',
    position: [3.2, 0, 2.4],
    rotation: [0, 0.5, 0],
    label: 'Grill jednorazowy z kiełbaskami (obóz główny)',
  },
  {
    id: 'bbq_east_camp',
    type: 'disposableBbq',
    position: [19.8, 0, 2.0],
    rotation: [0, -0.8, 0],
    label: 'Grill jednorazowy (obóz wschodni)',
  },
] as const;

export class FestivalPropsInstance {
  public readonly root = new THREE.Group();
  public readonly canMeshes = new Map<string, THREE.Object3D>();
  public readonly allProps = new Map<string, THREE.Object3D>();

  constructor() {
    this.root.name = 'FestivalProps';
  }

  /** Ukrywa puszkę po jej podniesieniu przez gracza w ramach CanCollector */
  public hideCan(canId: string): void {
    const mesh = this.canMeshes.get(canId);
    if (mesh) {
      mesh.visible = false;
    }
  }

  /** Pokazuje puszkę z powrotem (np. przy resetowaniu stanu gry) */
  public showCan(canId: string): void {
    const mesh = this.canMeshes.get(canId);
    if (mesh) {
      mesh.visible = true;
    }
  }

  public dispose(): void {
    this.root.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else {
            mesh.material.dispose();
          }
        }
      }
    });
    this.canMeshes.clear();
    this.allProps.clear();
    if (this.root.parent) {
      this.root.parent.remove(this.root);
    }
  }
}

/**
 * Klonuje i dopasowuje model trójwymiarowy do docelowej wysokości z zachowaniem proporcji
 */
export function createScaledProp(
  source: GLTF | null,
  targetHeight: number,
  fallbackColor = 0x888888,
): THREE.Object3D {
  if (!source || !source.scene) {
    const geo = new THREE.CylinderGeometry(targetHeight * 0.25, targetHeight * 0.25, targetHeight, 12);
    const mat = new THREE.MeshStandardMaterial({ color: fallbackColor, roughness: 0.7 });
    const fallback = new THREE.Mesh(geo, mat);
    fallback.position.y = targetHeight * 0.5;
    return fallback;
  }

  const model = clone(source.scene);
  const box = new THREE.Box3().setFromObject(model);
  const originalHeight = Math.max(0.001, box.max.y - box.min.y);
  const scale = targetHeight / originalHeight;
  model.scale.setScalar(scale);

  // Wyrównanie dolnej krawędzi do y=0
  box.setFromObject(model);
  model.position.y = -box.min.y;

  const wrapper = new THREE.Group();
  wrapper.add(model);
  return wrapper;
}

/**
 * Rozmieszcza modele rekwizytów (gitara, składane krzesła, puszki, plecaki, lodówki)
 * w świecie festiwalowym, dopasowując wysokość terenu pod każdym obiektem.
 */
export function placeFestivalProps(
  parent: THREE.Group,
  models: PropModelSources,
  terrainHeight: (x: number, z: number) => number,
): FestivalPropsInstance {
  const instance = new FestivalPropsInstance();

  // 1. Spawnowanie stałych rekwizytów scenografii
  for (const placement of FESTIVAL_PROP_PLACEMENTS) {
    const source = models[placement.type] ?? null;
    const targetHeight = PROP_TARGET_HEIGHTS[placement.type] * (placement.scaleMultiplier ?? 1.0);
    const obj = createScaledProp(source, targetHeight);

    const [x, , z] = placement.position;
    const y = terrainHeight(x, z);
    obj.position.set(x, y, z);

    if (placement.rotation) {
      obj.rotation.set(...placement.rotation);
    }

    obj.name = placement.id;
    instance.root.add(obj);
    instance.allProps.set(placement.id, obj);
  }

  // 2. Spawnowanie 10 puszek CanCollector w świecie 3D
  for (const can of DEFAULT_FESTIVAL_CANS) {
    const source = models.beerCan ?? null;
    const targetHeight = PROP_TARGET_HEIGHTS.beerCan;
    const obj = createScaledProp(source, targetHeight);

    const x = can.position[0];
    const z = can.position[2];
    const y = terrainHeight(x, z);
    obj.position.set(x, y, z);

    // Losowa subtelna rotacja puszki wokół osi Y dla naturalnego wyglądu
    const pseudoRandomRot = ((Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1) * Math.PI * 2;
    obj.rotation.y = pseudoRandomRot;

    obj.name = `CanCollector_${can.id}`;
    instance.root.add(obj);
    instance.canMeshes.set(can.id, obj);
    instance.allProps.set(can.id, obj);
  }

  parent.add(instance.root);
  return instance;
}
