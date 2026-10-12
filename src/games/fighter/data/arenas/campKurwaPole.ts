export interface ArenaDefinition {
  id: string;
  name: string;
  width: number;
  groundY: number;
  p1SpawnX: number;
  p2SpawnX: number;
  ambientColor: string;
  groundColor: string;
}

export const campKurwaPoleArena: ArenaDefinition = {
  id: 'camp_kurwa_pole',
  name: 'Obóz Kurwa Moje Pole',
  width: 1200,
  groundY: 0,
  p1SpawnX: -180,
  p2SpawnX: 180,
  ambientColor: '#121820',
  groundColor: '#2b3a24',
};
