export interface FlankiParticipant {
  id: string;
  name: string;
  role: 'thrower' | 'runner';
  team: 'A' | 'B';
  beerRemaining: number; // 0.0 to 1.0 (only throwers drink)
  isHuman?: boolean;
}

export interface FlankiTeam {
  name: string;
  throwers: FlankiParticipant[];
  runner: FlankiParticipant;
}

export class FlankiRoster {
  public teamA: FlankiTeam;
  public teamB: FlankiTeam;
  private currentThrowerIndex = 0; // index in the combined alternation list
  private throwOrder: FlankiParticipant[] = [];

  constructor(
    teamAConfig?: {
      name?: string;
      throwers: { id: string; name: string; isHuman?: boolean }[];
      runner: { id: string; name: string };
    },
    teamBConfig?: {
      name?: string;
      throwers: { id: string; name: string; isHuman?: boolean }[];
      runner: { id: string; name: string };
    },
  ) {
    const defaultTeamAThrowers = teamAConfig?.throwers ?? [
      { id: 'player', name: 'Ty (Gracz)', isHuman: true },
      { id: 'antena', name: 'Antena', isHuman: false },
    ];
    const defaultTeamARunner = teamAConfig?.runner ?? { id: 'kobra', name: 'Kobra' };

    const defaultTeamBThrowers = teamBConfig?.throwers ?? [
      { id: 'pien', name: 'Pień' },
      { id: 'chlebak', name: 'Chlebak' },
    ];
    const defaultTeamBRunner = teamBConfig?.runner ?? { id: 'dziaslo', name: 'Dziąsło' };

    this.teamA = {
      name: teamAConfig?.name ?? 'Twoja Ekipa',
      throwers: defaultTeamAThrowers.map((t) => ({
        id: t.id,
        name: t.name,
        role: 'thrower',
        team: 'A',
        beerRemaining: 1.0,
        isHuman: Boolean(t.isHuman),
      })),
      runner: {
        id: defaultTeamARunner.id,
        name: defaultTeamARunner.name,
        role: 'runner',
        team: 'A',
        beerRemaining: 0.0,
      },
    };

    this.teamB = {
      name: teamBConfig?.name ?? 'Rywale z Sektora',
      throwers: defaultTeamBThrowers.map((t) => ({
        id: t.id,
        name: t.name,
        role: 'thrower',
        team: 'B',
        beerRemaining: 1.0,
        isHuman: Boolean(t.isHuman),
      })),
      runner: {
        id: defaultTeamBRunner.id,
        name: defaultTeamBRunner.name,
        role: 'runner',
        team: 'B',
        beerRemaining: 0.0,
      },
    };

    this.buildThrowOrder();
  }

  /**
   * Buduje naprzemienną listę rzutów: Team A [0], Team B [0], Team A [1], Team B [1]...
   */
  public buildThrowOrder(): void {
    this.throwOrder = [];
    const maxLen = Math.max(this.teamA.throwers.length, this.teamB.throwers.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < this.teamA.throwers.length) {
        this.throwOrder.push(this.teamA.throwers[i]);
      }
      if (i < this.teamB.throwers.length) {
        this.throwOrder.push(this.teamB.throwers[i]);
      }
    }
  }

  public getCurrentThrower(): FlankiParticipant {
    if (this.throwOrder.length === 0) {
      throw new Error('Brak rzucających w kolejce.');
    }
    return this.throwOrder[this.currentThrowerIndex % this.throwOrder.length];
  }

  public advanceTurn(): FlankiParticipant {
    this.currentThrowerIndex = (this.currentThrowerIndex + 1) % this.throwOrder.length;
    return this.getCurrentThrower();
  }

  /**
   * Zwraca biegacza drużyny broniącej (przeciwnej do drużyny rzucającego).
   */
  public getDefendingRunner(): FlankiParticipant {
    const thrower = this.getCurrentThrower();
    return thrower.team === 'A' ? this.teamB.runner : this.teamA.runner;
  }

  /**
   * Zwraca rzucających drużyny atakującej (którzy piją po strąceniu puszki).
   */
  public getAttackingThrowers(): FlankiParticipant[] {
    const thrower = this.getCurrentThrower();
    return thrower.team === 'A' ? this.teamA.throwers : this.teamB.throwers;
  }

  /**
   * Zmniejsza ilość piwa u rzucających danej drużyny o zadaną wartość.
   */
  public drinkBeer(team: 'A' | 'B', amount: number): void {
    const throwers = team === 'A' ? this.teamA.throwers : this.teamB.throwers;
    for (const t of throwers) {
      t.beerRemaining = Math.max(0, t.beerRemaining - amount);
    }
  }

  /**
   * Nakłada karnego łyka (+20% piwa) w przypadku picia po okrzyku STOP.
   */
  public applyPenalty(team: 'A' | 'B', amount = 0.2): void {
    const throwers = team === 'A' ? this.teamA.throwers : this.teamB.throwers;
    for (const t of throwers) {
      t.beerRemaining = Math.min(1.0, t.beerRemaining + amount);
    }
  }

  /**
   * Sprawdza, czy dana drużyna wypiła całe piwo (wszyscy jej rzucający mają 0.00).
   */
  public isTeamFinished(team: 'A' | 'B'): boolean {
    const throwers = team === 'A' ? this.teamA.throwers : this.teamB.throwers;
    return throwers.length > 0 && throwers.every((t) => t.beerRemaining <= 0.001);
  }

  public getWinner(): 'A' | 'B' | null {
    if (this.isTeamFinished('A')) return 'A';
    if (this.isTeamFinished('B')) return 'B';
    return null;
  }

  public isGameOver(): boolean {
    return this.getWinner() !== null;
  }

  public getTurnIndex(): number {
    return this.currentThrowerIndex;
  }

  public setTurnIndex(index: number): void {
    this.currentThrowerIndex = Math.max(0, Math.floor(index)) % this.throwOrder.length;
  }

  public setHumans(players: { id: string; name: string; team: 'A' | 'B' }[]): void {
    this.teamA.runner = { id: 'kobra', name: 'Kobra', role: 'runner', team: 'A', beerRemaining: 0 };
    this.teamB.runner = { id: 'dziaslo', name: 'Dziąsło', role: 'runner', team: 'B', beerRemaining: 0 };
    this.teamA.throwers = [
      { id: 'antena', name: 'Antena', role: 'thrower', team: 'A', beerRemaining: 1, isHuman: false },
    ];
    this.teamB.throwers = [
      { id: 'pien', name: 'Pień', role: 'thrower', team: 'B', beerRemaining: 1, isHuman: false },
      { id: 'chlebak', name: 'Chlebak', role: 'thrower', team: 'B', beerRemaining: 1, isHuman: false },
    ];
    for (const player of [...players].reverse()) {
      const team = player.team === 'A' ? this.teamA : this.teamB;
      if (team.throwers.length >= 2) team.throwers.pop();
      team.throwers.unshift({ ...player, role: 'thrower', beerRemaining: 1, isHuman: true });
    }
    this.currentThrowerIndex = 0;
    this.buildThrowOrder();
  }

  public reset(): void {
    this.currentThrowerIndex = 0;
    for (const t of this.teamA.throwers) t.beerRemaining = 1.0;
    for (const t of this.teamB.throwers) t.beerRemaining = 1.0;
  }

  selectRunner(teamId: 'A' | 'B', id: string): boolean {
    const team = teamId === 'A' ? this.teamA : this.teamB;
    if (team.runner.id === id) return true;
    const index = team.throwers.findIndex((p) => p.id === id);
    if (index < 0) return false;
    const oldRunner = team.runner;
    team.runner = { ...team.throwers[index], role: 'runner', beerRemaining: 0 };
    team.throwers[index] = { ...oldRunner, role: 'thrower', beerRemaining: 1 };
    this.currentThrowerIndex = 0;
    this.buildThrowOrder();
    return true;
  }
}
