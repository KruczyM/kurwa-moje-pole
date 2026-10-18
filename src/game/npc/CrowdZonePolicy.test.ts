import { describe, expect, it } from 'vitest';
import {
  CROWD_ZONE_IDS,
  CROWD_ZONES,
  calculateFacingYaw,
  getDistributionProfile,
  getZoneCapacity,
  getZoneDefinition,
  getZoneForRole,
  isInsideZone,
  normalizeSeed,
  sampleAudienceTarget,
  sampleZoneForProfile,
  type CrowdZoneId,
} from './CrowdZonePolicy';

describe('CrowdZonePolicy — D1 Strefy aktywności i rozkład tłumu', () => {
  describe('Struktura i definicje stref', () => {
    it('definiuje wszystkie wymagane strefy festiwalowe', () => {
      const requiredZones: CrowdZoneId[] = [
        'MAIN_STAGE',
        'SMALL_STAGE',
        'ASP_STAGE',
        'PLAZA',
        'CAMP',
        'KRISHNA',
      ];

      for (const zoneId of requiredZones) {
        expect(CROWD_ZONE_IDS).toContain(zoneId);
        const zone = getZoneDefinition(zoneId);
        expect(zone).toBeDefined();
        expect(zone.id).toBe(zoneId);
        expect(zone.bounds.minX).toBeLessThan(zone.bounds.maxX);
        expect(zone.bounds.minZ).toBeLessThan(zone.bounds.maxZ);
        expect(zone.capacity).toBeGreaterThan(0);
        expect(zone.safeFallbackPoint).toBeDefined();
        expect(isInsideZone(zoneId, zone.safeFallbackPoint.x, zone.safeFallbackPoint.z)).toBe(true);
      }
    });

    it('Duża Scena posiada największą pojemność widowni', () => {
      const mainStageCap = getZoneCapacity('MAIN_STAGE');
      expect(mainStageCap).toBeGreaterThanOrEqual(100);
      for (const id of CROWD_ZONE_IDS) {
        if (id !== 'MAIN_STAGE') {
          expect(getZoneCapacity(id)).toBeLessThan(mainStageCap);
        }
      }
    });

    it('zgłasza błąd dla nieznanego identyfikatora strefy', () => {
      // @ts-expect-error test niepoprawnego id
      expect(() => getZoneDefinition('UNKNOWN_ZONE')).toThrow('Unknown crowd zone ID');
      // @ts-expect-error test niepoprawnego profilu
      expect(() => getDistributionProfile('unknown_profile')).toThrow('Unknown distribution profile');
    });
  });

  describe('Kalkulacja kąta patrzenia (yaw)', () => {
    it('oblicza poprawny kąt patrzenia w stronę sceny na osi X', () => {
      // Widz na zachód od Dużej Sceny (x=150, z=18), scena w (x=216, z=18)
      // Wektor dx = +66, dz = 0 -> atan2(66, 0) = PI / 2 (kierunek wschodni)
      const yaw = calculateFacingYaw({ x: 150, z: 18 }, { x: 216, z: 18 });
      expect(yaw).toBeCloseTo(Math.PI / 2, 4);
    });

    it('oblicza poprawny kąt patrzenia na osi Z', () => {
      // Widz na północ od celu (x=216, z=0), cel w (x=216, z=18) -> dx=0, dz=+18 -> yaw = 0 (kierunek południowy +Z)
      const yawSouth = calculateFacingYaw({ x: 216, z: 0 }, { x: 216, z: 18 });
      expect(yawSouth).toBeCloseTo(0, 4);

      // Widz na południe od celu (x=216, z=36), cel w (x=216, z=18) -> dx=0, dz=-18 -> yaw = PI lub -PI
      const yawNorth = calculateFacingYaw({ x: 216, z: 36 }, { x: 216, z: 18 });
      expect(Math.abs(yawNorth)).toBeCloseTo(Math.PI, 4);
    });

    it('zwraca 0 dla identycznych pozycji celu i widza', () => {
      expect(calculateFacingYaw({ x: 100, z: 50 }, { x: 100, z: 50 })).toBe(0);
    });
  });

  describe('Deterministyczne próbkowanie celów widowni', () => {
    it('zwraca identyczne współrzędne dla tego samego ziarna (seed)', () => {
      const target1 = sampleAudienceTarget('MAIN_STAGE', 42);
      const target2 = sampleAudienceTarget('MAIN_STAGE', 42);
      expect(target1.x).toBe(target2.x);
      expect(target1.z).toBe(target2.z);
      expect(target1.facingYaw).toBe(target2.facingYaw);
      expect(target1.zoneId).toBe('MAIN_STAGE');
    });

    it('obsługuje tekstowe ziarna z identycznym rezultatem', () => {
      const targetA = sampleAudienceTarget('PLAZA', 'npc_woodstock_fan_01');
      const targetB = sampleAudienceTarget('PLAZA', 'npc_woodstock_fan_01');
      expect(targetA.x).toBe(targetB.x);
      expect(targetA.z).toBe(targetB.z);
    });

    it('rozprasza punkty dla różnych ziaren wewnątrz strefy', () => {
      const points = new Set<string>();
      for (let seed = 1; seed <= 30; seed++) {
        const target = sampleAudienceTarget('MAIN_STAGE', seed * 73);
        expect(isInsideZone('MAIN_STAGE', target.x, target.z)).toBe(true);
        points.add(`${target.x.toFixed(2)}_${target.z.toFixed(2)}`);
      }
      // Różne ziarna powinny dać przynajmniej 25 unikalnych punktów na 30 prób
      expect(points.size).toBeGreaterThanOrEqual(25);
    });

    it('nigdy nie umieszcza widza na podeście Dużej Sceny ani poza widownią', () => {
      const mainStage = CROWD_ZONES.MAIN_STAGE;
      for (let seed = 0; seed < 100; seed++) {
        const target = sampleAudienceTarget('MAIN_STAGE', seed);
        // Konstrukcja sceny zaczyna się od x >= 194
        expect(target.x).toBeLessThan(192);
        expect(target.x).toBeGreaterThanOrEqual(mainStage.bounds.minX);
        expect(target.z).toBeGreaterThanOrEqual(mainStage.bounds.minZ);
        expect(target.z).toBeLessThanOrEqual(mainStage.bounds.maxZ);
      }
    });

    it('utrzymuje drożność korytarza ewakuacyjnego pod Dużą Sceną', () => {
      // Korytarz zdefiniowany w przedziale z: [16.5, 19.5]
      for (let seed = 0; seed < 100; seed++) {
        const target = sampleAudienceTarget('MAIN_STAGE', seed);
        const inCorridor = target.z > 16.5 && target.z < 19.5;
        expect(inCorridor).toBe(false);
      }
    });

    it('wszyscy widzowie pod Dużą Sceną patrzą w stronę centrum sceny', () => {
      // Scena znajduje się na wschód (x=216), widzowie na x < 190.
      // Kąt patrzenia powinien mieć składową skierowaną na wschód (cos(yaw - PI/2) bliskie 1 lub dx > 0)
      for (let seed = 0; seed < 50; seed++) {
        const target = sampleAudienceTarget('MAIN_STAGE', seed);
        // dx = 216 - target.x > 0
        // yaw = Math.atan2(dx, dz) -> ponieważ dx > 0, yaw musi być w przedziale (0, PI)
        expect(target.facingYaw).toBeGreaterThan(0);
        expect(target.facingYaw).toBeLessThan(Math.PI);
      }
    });
  });

  describe('Profile rozkładu tłumu (Concert vs Quiet)', () => {
    it('profil koncertowy posiada wymagane wagi: 50-60% Duża Scena, 20-25% Plaza', () => {
      const concertProfile = getDistributionProfile('concert');
      expect(concertProfile.MAIN_STAGE).toBeGreaterThanOrEqual(0.5);
      expect(concertProfile.MAIN_STAGE).toBeLessThanOrEqual(0.6);

      expect(concertProfile.PLAZA).toBeGreaterThanOrEqual(0.2);
      expect(concertProfile.PLAZA).toBeLessThanOrEqual(0.25);

      const total = Object.values(concertProfile).reduce((sum, w) => sum + w, 0);
      expect(total).toBeCloseTo(1.0, 4);

      // Reszta w strefach obozów, ASP i małej sceny
      const remainder =
        concertProfile.CAMP + concertProfile.ASP_STAGE + concertProfile.SMALL_STAGE + concertProfile.KRISHNA;
      expect(remainder).toBeCloseTo(1.0 - concertProfile.MAIN_STAGE - concertProfile.PLAZA, 4);
    });

    it('profil spokojny (quiet) posiada równomierny rozkład', () => {
      const quietProfile = getDistributionProfile('quiet');
      const expectedShare = 1 / 6;
      for (const id of CROWD_ZONE_IDS) {
        expect(quietProfile[id]).toBeCloseTo(expectedShare, 4);
      }
    });

    it('statystyczny rozkład próbkowania w profilu koncertowym mieści się w granicach tolerancji', () => {
      const counts: Record<CrowdZoneId, number> = {
        MAIN_STAGE: 0,
        SMALL_STAGE: 0,
        ASP_STAGE: 0,
        PLAZA: 0,
        CAMP: 0,
        KRISHNA: 0,
      };

      const SAMPLE_SIZE = 5000;
      for (let i = 0; i < SAMPLE_SIZE; i++) {
        const zone = sampleZoneForProfile('concert', i);
        counts[zone]++;
      }

      const mainStageShare = counts.MAIN_STAGE / SAMPLE_SIZE;
      const plazaShare = counts.PLAZA / SAMPLE_SIZE;

      // Oczekujemy ~55% (tolerancja 50% - 60%)
      expect(mainStageShare).toBeGreaterThanOrEqual(0.5);
      expect(mainStageShare).toBeLessThanOrEqual(0.6);

      // Oczekujemy ~22% (tolerancja 19% - 25%)
      expect(plazaShare).toBeGreaterThanOrEqual(0.19);
      expect(plazaShare).toBeLessThanOrEqual(0.25);
    });

    it('statystyczny rozkład próbkowania w profilu quiet jest zrównoważony', () => {
      const counts: Record<CrowdZoneId, number> = {
        MAIN_STAGE: 0,
        SMALL_STAGE: 0,
        ASP_STAGE: 0,
        PLAZA: 0,
        CAMP: 0,
        KRISHNA: 0,
      };

      const SAMPLE_SIZE = 6000;
      for (let i = 0; i < SAMPLE_SIZE; i++) {
        const zone = sampleZoneForProfile('quiet', i);
        counts[zone]++;
      }

      // Każda z 6 stref powinna otrzymać około 16.7% (dopuszczamy zakres 13% do 20%)
      for (const id of CROWD_ZONE_IDS) {
        const share = counts[id] / SAMPLE_SIZE;
        expect(share).toBeGreaterThan(0.13);
        expect(share).toBeLessThan(0.2);
      }
    });
  });

  describe('Przypisanie strefy dla roli NPC (getZoneForRole)', () => {
    it('kieruje tancerza (stage_dancer) pod Dużą Scenę', () => {
      expect(getZoneForRole('stage_dancer', 'concert')).toBe('MAIN_STAGE');
      expect(getZoneForRole('stage_dancer', 'quiet')).toBe('MAIN_STAGE');
    });

    it('kieruje słuchacza ASP (asp_listener) do namiotu ASP', () => {
      expect(getZoneForRole('asp_listener', 'concert')).toBe('ASP_STAGE');
      expect(getZoneForRole('asp_listener', 'quiet')).toBe('ASP_STAGE');
    });

    it('kieruje stojących w kolejce (food_queue) na pasaż gastro (PLAZA)', () => {
      expect(getZoneForRole('food_queue', 'concert')).toBe('PLAZA');
      expect(getZoneForRole('food_queue', 'quiet')).toBe('PLAZA');
    });

    it('rozdziela wędrowców (walker) zgodnie z profilem', () => {
      const zoneConcert = getZoneForRole('walker', 'concert', 123);
      expect(CROWD_ZONE_IDS).toContain(zoneConcert);

      const zoneQuiet = getZoneForRole('walker', 'quiet', 123);
      expect(CROWD_ZONE_IDS).toContain(zoneQuiet);
    });
  });

  describe('Normalizacja nasion (normalizeSeed)', () => {
    it('zwraca 32-bitową liczbę całkowitą dla liczb i napisów', () => {
      expect(normalizeSeed(123)).toBe(123);
      expect(normalizeSeed(-1)).toBe(4294967295);
      expect(normalizeSeed(3.14159)).toBe(3);
      expect(normalizeSeed('test_seed')).toBeGreaterThan(0);
      expect(normalizeSeed(Number.NaN)).toBe(0);
    });
  });
});
