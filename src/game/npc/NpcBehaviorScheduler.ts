export type NpcBehaviorState = 'idle' | 'wander' | 'social' | 'run-home' | 'dance' | 'sit';

export type NpcBehaviorProfile = {
  initialIdleSeconds: number;
  idleSeconds: readonly [minimum: number, maximum: number];
  socialSeconds: readonly [minimum: number, maximum: number];
  socialChance: number;
};

export type NpcBehaviorFacts = {
  nearEdge: boolean;
  insideSafeZone: boolean;
  arrived: boolean;
  socialAvailable: boolean;
  speakerPlaying?: boolean;
  canDance?: boolean;
  seatAvailable?: boolean;
  playerNearSeat?: boolean;
};

export type NpcBehaviorAction = 'idle' | 'wander' | 'social' | 'run-home' | 'dance' | 'sit';

export const NPC_BEHAVIOR_PROFILES: readonly NpcBehaviorProfile[] = [
  { initialIdleSeconds: 1.2, idleSeconds: [8, 16], socialSeconds: [4, 8], socialChance: 0.34 },
  { initialIdleSeconds: 2.8, idleSeconds: [2, 6], socialSeconds: [3, 6], socialChance: 0.18 },
  { initialIdleSeconds: 4.1, idleSeconds: [3, 8], socialSeconds: [5, 9], socialChance: 0.42 },
  { initialIdleSeconds: 6.4, idleSeconds: [10, 20], socialSeconds: [4, 7], socialChance: 0.25 },
  { initialIdleSeconds: 3.5, idleSeconds: [2, 5], socialSeconds: [3, 7], socialChance: 0.16 },
  { initialIdleSeconds: 8.2, idleSeconds: [12, 24], socialSeconds: [5, 10], socialChance: 0.3 },
  { initialIdleSeconds: 5.3, idleSeconds: [4, 10], socialSeconds: [4, 8], socialChance: 0.38 },
  { initialIdleSeconds: 7.1, idleSeconds: [3, 7], socialSeconds: [3, 6], socialChance: 0.2 },
];

/** Tworzy szybki, powtarzalny generator używany niezależnie przez każdego NPC. */
function createRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** Steruje długoterminowymi stanami NPC, cooldownami i pamięcią odwiedzanych sektorów. */
export class NpcBehaviorScheduler {
  state: NpcBehaviorState = 'idle';
  travelling = false;
  private remaining: number;
  private socialCooldown = 0;
  private runHomeCooldown = 0;
  private danceCooldown = 0;
  private seatCooldown = 0;
  private readonly recentSectors: number[] = [];
  private readonly randomSource: () => number;

  constructor(
    readonly profile: NpcBehaviorProfile,
    seed: number,
  ) {
    this.remaining = profile.initialIdleSeconds;
    this.randomSource = createRandom(seed);
    this.danceCooldown = 4 + this.random() * 8;
    this.seatCooldown = 6 + this.random() * 12;
  }

  /** Zwraca losową wartość schedulera, aby również wybór celu był deterministyczny dla postaci. */
  random() {
    return this.randomSource();
  }

  /** Wybiera sektor inny niż ostatnio odwiedzane i zapisuje krótką historię wyborów. */
  nextSector(sectorCount: number) {
    if (sectorCount <= 0) return 0;
    const available = Array.from({ length: sectorCount }, (_, index) => index).filter(
      (index) => !this.recentSectors.includes(index),
    );
    const pool = available.length ? available : Array.from({ length: sectorCount }, (_, index) => index);
    const sector = pool[Math.floor(this.random() * pool.length)] ?? 0;
    this.recentSectors.push(sector);
    while (this.recentSectors.length > Math.min(3, sectorCount - 1)) this.recentSectors.shift();
    return sector;
  }

  /** Aktualizuje zegary i zwraca wyłącznie akcję wymagającą zmiany celu ruchu. */
  update(deltaTime: number, facts: NpcBehaviorFacts): NpcBehaviorAction | null {
    const dt = Math.max(0, deltaTime);
    this.socialCooldown = Math.max(0, this.socialCooldown - dt);
    this.runHomeCooldown = Math.max(0, this.runHomeCooldown - dt);
    this.danceCooldown = Math.max(0, this.danceCooldown - dt);
    this.seatCooldown = Math.max(0, this.seatCooldown - dt);

    if (facts.nearEdge && this.state !== 'run-home' && this.runHomeCooldown <= 0) {
      return this.beginTravel('run-home');
    }
    if (this.state === 'run-home' && facts.insideSafeZone) {
      this.runHomeCooldown = 8;
      return this.beginIdle(1.5, 3.5);
    }
    if (this.travelling) {
      if (!facts.arrived) return null;
      this.travelling = false;
      if (this.state === 'social') {
        this.remaining = this.range(this.profile.socialSeconds);
        return null;
      }
      if (this.state === 'dance') {
        this.remaining = 6 + this.random() * 8;
        return null;
      }
      if (this.state === 'sit') {
        this.remaining = 10 + this.random() * 15;
        return null;
      }
      return this.beginIdle();
    }

    this.remaining -= dt;
    if (this.remaining > 0) {
      if (this.state === 'sit' && facts.playerNearSeat) {
        this.seatCooldown = 15;
        return this.beginIdle(1.0, 2.0);
      }
      if (this.state === 'dance' && facts.speakerPlaying === false) {
        this.danceCooldown = 10;
        return this.beginIdle(1.0, 2.0);
      }
      return null;
    }
    if (this.state === 'social' || this.state === 'dance' || this.state === 'sit') {
      if (this.state === 'dance') this.danceCooldown = 15 + this.random() * 20;
      if (this.state === 'sit') this.seatCooldown = 25 + this.random() * 30;
      return this.beginIdle();
    }
    if (this.state === 'idle') {
      // 1. Głośnik gra -> szansa na podejście pod namiot i taniec
      if (facts.speakerPlaying && facts.canDance && this.danceCooldown <= 0 && this.random() < 0.4) {
        this.danceCooldown = 20 + this.random() * 25;
        return this.beginTravel('dance');
      }
      // 2. Krzesło w obozie wolne -> szansa na podejście i odpoczynek na siedząco
      if (facts.seatAvailable && this.seatCooldown <= 0 && this.random() < 0.3) {
        this.seatCooldown = 25 + this.random() * 35;
        return this.beginTravel('sit');
      }
      // 3. Social
      if (
        facts.socialAvailable &&
        this.socialCooldown <= 0 &&
        this.random() < this.profile.socialChance
      ) {
        this.socialCooldown = 24 + this.random() * 20;
        return this.beginTravel('social');
      }
    }
    return this.beginTravel('wander');
  }

  /** Przywraca krótki Idle, gdy grid nie potrafi wyznaczyć żądanej trasy. */
  routeFailed() {
    if (this.state === 'dance') this.danceCooldown = 10;
    if (this.state === 'sit') this.seatCooldown = 15;
    return this.beginIdle(0.8, 1.8);
  }

  /** Wymusza rozpoczęcie nowego wander z poziomu managera lub procedury recovery. */
  forceWander() {
    return this.beginTravel('wander');
  }

  /** Przełącza stan na podróż do nowego celu. */
  private beginTravel(state: Exclude<NpcBehaviorState, 'idle'>): NpcBehaviorAction {
    this.state = state;
    this.travelling = true;
    this.remaining = 0;
    return state;
  }

  /** Przełącza stan na bezczynność o czasie wynikającym z profilu albo jawnego zakresu. */
  private beginIdle(minimum?: number, maximum?: number): NpcBehaviorAction {
    this.state = 'idle';
    this.travelling = false;
    this.remaining =
      minimum === undefined || maximum === undefined
        ? this.range(this.profile.idleSeconds)
        : minimum + this.random() * (maximum - minimum);
    return 'idle';
  }

  /** Losuje czas z domkniętego zakresu profilu. */
  private range(range: readonly [number, number]) {
    return range[0] + this.random() * (range[1] - range[0]);
  }
}
