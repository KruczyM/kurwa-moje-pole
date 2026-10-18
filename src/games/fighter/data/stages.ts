export interface StageDefinition {
  id: string;
  name: string;
  subtitle: string;
  theme: 'night' | 'day' | 'sunset' | 'twilight';
  imagePath: string;
  ambientLight: string;
  groundOffsetRatio: number; // Vertical fraction of image where fighters stand
}

export const STAGES: Record<string, StageDefinition> = {
  main_stage: {
    id: 'main_stage',
    name: 'Duża Scena Nocą',
    subtitle: 'Koncert rockowy, telebimy LED i lasery w niebo',
    theme: 'night',
    imagePath: 'game-assets/2d/fighter/stages/main_stage.jpg',
    ambientLight: '#38bdf8',
    groundOffsetRatio: 0.9,
  },
  grzybek: {
    id: 'grzybek',
    name: 'Kultowy Grzybek',
    subtitle: 'Wodne orzeźwienie, fontanna i festiwalowe błoto',
    theme: 'day',
    imagePath: 'game-assets/2d/fighter/stages/grzybek.jpg',
    ambientLight: '#06b6d4',
    groundOffsetRatio: 0.86,
  },
  sunset_camp: {
    id: 'sunset_camp',
    name: 'Pole Namiotowe & Młyn',
    subtitle: 'Złoty zachód słońca, diabelski młyn i miasteczko namiotowe',
    theme: 'sunset',
    imagePath: 'game-assets/2d/fighter/stages/sunset_camp.jpg',
    ambientLight: '#f59e0b',
    groundOffsetRatio: 0.88,
  },
  krishna_village: {
    id: 'krishna_village',
    name: 'Wioska Kryszny',
    subtitle: 'Wóz Ratha Jatra, barwny korowód w sari, balony i strefa chilloutu',
    theme: 'day',
    imagePath: 'game-assets/2d/fighter/stages/krishna_village.jpg',
    ambientLight: '#f59e0b',
    groundOffsetRatio: 0.86,
  },
};

export const STAGE_KEYS = Object.keys(STAGES);
