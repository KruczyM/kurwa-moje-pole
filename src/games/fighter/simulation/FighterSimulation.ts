import {
  FighterDefinition,
  FighterState,
  INPUT,
  MatchSnapshot,
  MatchState,
  MoveDefinition,
} from './CombatTypes';
import { InputBuffer } from './InputBuffer';
import { resolveCombatPair } from './CombatResolver';
import { resolveFacing, resolvePushboxes, updatePhysics } from './Movement';
import { prepareFighter } from './combatTiming';

export interface SimulationEvent {
  type:
    | 'hit'
    | 'block'
    | 'ko'
    | 'launch'
    | 'round_start'
    | 'round_end'
    | 'match_end'
    | 'meter_empty'
    | 'swing'
    | 'land'
    | 'meter_ready';
  tick: number;
  data?: any;
}

export class FighterSimulation {
  private state: MatchState;
  private readonly def1: FighterDefinition;
  private readonly def2: FighterDefinition;
  private readonly buffer1 = new InputBuffer();
  private readonly buffer2 = new InputBuffer();
  private events: SimulationEvent[] = [];

  constructor(
    def1: FighterDefinition,
    def2: FighterDefinition,
    private readonly options: { training?: boolean } = {},
  ) {
    this.def1 = prepareFighter(def1);
    this.def2 = prepareFighter(def2);
    this.state = this.createInitialState();
  }

  private createFighterState(def: FighterDefinition, facing: 1 | -1, spawnX: number): FighterState {
    return {
      id: def.id,
      x: spawnX,
      y: 0,
      vx: 0,
      vy: 0,
      facing,
      state: 'idle',
      stateTicks: 0,
      hp: def.maxHp,
      maxHp: def.maxHp,
      meter: this.options.training ? 100 : 0,
      currentMove: null,
      moveTick: 0,
      hitstop: 0,
      isGrounded: true,
      comboHits: 0,
      lastHitBy: null,
      hasHit: false,
      stunTicks: 0,
      juggleHits: 0,
    };
  }

  private createInitialState(): MatchState {
    return {
      tick: 0,
      training: this.options.training === true,
      roundTimer: 90.0,
      roundNumber: 1,
      roundState: 'fight',
      winner: null,
      p1Wins: 0,
      p2Wins: 0,
      stateTicks: 0,
      p1: this.createFighterState(this.def1, 1, -180),
      p2: this.createFighterState(this.def2, -1, 180),
    };
  }

  getState(): MatchState {
    return this.state;
  }

  getEvents(): SimulationEvent[] {
    const ev = this.events;
    this.events = [];
    return ev;
  }

  update(p1Input: number, p2Input: number): MatchState {
    this.state.tick += 1;
    if (this.options.training) {
      this.state.p1.meter = 100;
      this.state.p2.hp = this.state.p2.maxHp;
    }
    // Push inputs to buffers
    this.buffer1.push(p1Input);
    this.buffer2.push(p2Input);

    if ((this.state.superFreezeTicks ?? 0) > 0) {
      this.state.superFreezeTicks!--;
      return this.state;
    }
    this.state.stateTicks += 1;

    if (this.state.roundState === 'fight') {
      this.updateRoundTimer();
      if (this.state.roundState !== 'fight') return this.state;
      const frozen1 = this.state.p1.hitstop > 0;
      const frozen2 = this.state.p2.hitstop > 0;
      this.updateFighter(this.state.p1, this.def1, this.buffer1);
      this.updateFighter(this.state.p2, this.def2, this.buffer2);
      if (this.options.training) this.state.p1.meter = 100;
      // Both inputs may initiate a simultaneous ultimate. Neither hitboxes nor
      // physics resolve on the activation step; all combat resumes after freeze.
      if ((this.state.superFreezeTicks ?? 0) > 0) return this.state;

      const meterBefore = [this.state.p1.meter, this.state.p2.meter];
      // Hit resolution
      if (!frozen1 && !frozen2) {
        const [hitP1, hitP2] = resolveCombatPair(
          this.state.p1,
          this.def1,
          this.state.p2,
          this.def2,
          p1Input,
          p2Input,
        );
        if (hitP1) {
          this.events.push({
            type: hitP1.blocked ? 'block' : hitP1.isLauncher ? 'launch' : 'hit',
            tick: this.state.tick,
            data: hitP1,
          });
        }

        if (hitP2) {
          this.events.push({
            type: hitP2.blocked ? 'block' : hitP2.isLauncher ? 'launch' : 'hit',
            tick: this.state.tick,
            data: hitP2,
          });
        }
      }

      [this.state.p1, this.state.p2].forEach((fighter, slot) => {
        if (meterBefore[slot]! < 100 && fighter.meter >= 100)
          this.events.push({ type: 'meter_ready', tick: this.state.tick, data: { slot: slot + 1 } });
      });
      const airborne = [!this.state.p1.isGrounded, !this.state.p2.isGrounded];
      // Physics and boundaries
      if (!frozen1 && this.state.p1.hitstop <= 0) updatePhysics(this.state.p1, this.def1);
      if (!frozen2 && this.state.p2.hitstop <= 0) updatePhysics(this.state.p2, this.def2);

      [this.state.p1, this.state.p2].forEach((fighter, slot) => {
        if (airborne[slot] && fighter.isGrounded)
          this.events.push({ type: 'land', tick: this.state.tick, data: { slot: slot + 1 } });
      });
      resolvePushboxes(this.state.p1, this.def1, this.state.p2, this.def2);
      resolveFacing(this.state.p1, this.state.p2);

      // Training keeps reactions and damage events, but never permits a KO.
      if (this.options.training) {
        this.state.p2.hp = this.state.p2.maxHp;
        this.state.p1.meter = 100;
      } else this.checkRoundEnd();
    } else if (this.state.roundState === 'roundOver') {
      if (this.state.stateTicks > 120) {
        // 2 seconds delay before next round
        this.nextRound();
      }
    }

    return this.state;
  }

  private updateRoundTimer(): void {
    if (this.options.training) return;
    // 60 ticks per second
    if (this.state.stateTicks % 60 === 0 && this.state.roundTimer > 0) {
      this.state.roundTimer -= 1.0;
      if (this.state.roundTimer <= 0) {
        this.state.roundTimer = 0;
        this.endRoundByTimeout();
      }
    }
  }

  private updateFighter(fighter: FighterState, def: FighterDefinition, buf: InputBuffer): void {
    // Decrement hitstop freeze
    if (fighter.hitstop > 0) {
      fighter.hitstop -= 1;
      return;
    }

    fighter.stateTicks += 1;

    // Reset combo counter if not in hitstun/knockdown
    if (fighter.state !== 'hit_stun' && fighter.state !== 'knockdown') {
      fighter.comboHits = 0;
    }

    // Handle reaction states
    if (fighter.state === 'hit_stun' || fighter.state === 'block_high' || fighter.state === 'block_low') {
      fighter.vx *= 0.82;
      // Airborne fighters in hit_stun stay airborne until physics lands them
      fighter.stunTicks = Math.max(0, (fighter.stunTicks ?? 0) - 1);
      if (!fighter.isGrounded || fighter.stunTicks > 0) return;
      fighter.state = 'idle';
      fighter.stateTicks = 0;
      fighter.vx = 0;
    }

    if (fighter.state === 'knockdown') {
      fighter.vx *= 0.9;
      // Tech roll / Quick rise: pressing or holding any attack button accelerates recovery
      const wantsQuickRise =
        buf.isDown(INPUT.LP) ||
        buf.isDown(INPUT.RP) ||
        buf.isDown(INPUT.LK) ||
        buf.isDown(INPUT.RK) ||
        buf.justPressed(INPUT.LP) ||
        buf.justPressed(INPUT.RP) ||
        buf.justPressed(INPUT.LK) ||
        buf.justPressed(INPUT.RK);
      const minKnockdownTicks = wantsQuickRise ? 24 : 42;

      if (fighter.isGrounded && fighter.stateTicks > minKnockdownTicks) {
        fighter.state = 'get_up';
        fighter.stateTicks = 0;
      }
      return;
    }

    if (fighter.state === 'get_up') {
      fighter.vx = 0;
      if (fighter.stateTicks >= 36) {
        fighter.state = 'idle';
        fighter.stateTicks = 0;
        fighter.comboHits = 0;
        fighter.juggleHits = 0;
      }
      return;
    }

    // Handle active attack
    if (fighter.state === 'attack') {
      fighter.moveTick += 1;
      const move = fighter.currentMove!;
      const totalTicks = move.startup + move.active + move.recovery;

      // Check cancel window for special moves or classic target combo strings
      if (
        fighter.hasHit &&
        move.cancelWindow &&
        fighter.moveTick >= move.startup + move.active &&
        fighter.moveTick <= move.startup + move.active + move.cancelWindow
      ) {
        // Special or Ultimate cancel (requires full 100% meter)
        if (buf.justPressed(INPUT.SPECIAL)) {
          if (fighter.meter >= 100) {
            const ultMove = def.moves[def.ultimateMoveId] ?? def.moves[def.specialMoveId];
            if (ultMove) {
              this.executeMove(fighter, ultMove);
              fighter.meter = 0;
              return;
            }
          } else {
            this.events.push({
              type: 'meter_empty',
              tick: this.state.tick,
              data: { fighterId: fighter.id, currentMeter: fighter.meter },
            });
          }
        }

        // Classic 1-2 String: LP (Light Punch) cancels into RP (Heavy Punch)
        if (move.id === 'light_punch' && buf.justPressed(INPUT.RP) && def.moves['heavy_punch']) {
          this.executeMove(fighter, def.moves['heavy_punch']!);
          return;
        }

        // Classic 1-4 String: LP (Light Punch) cancels into RK (Heavy Kick)
        if (move.id === 'light_punch' && buf.justPressed(INPUT.RK) && def.moves['heavy_kick']) {
          this.executeMove(fighter, def.moves['heavy_kick']!);
          return;
        }
      }

      if (fighter.moveTick >= totalTicks) {
        fighter.state = 'idle';
        fighter.currentMove = null;
        fighter.moveTick = 0;
        fighter.hasHit = false;
        fighter.stateTicks = 0;
        if (!fighter.isGrounded) fighter.state = 'jump_air';
      }
      return;
    }

    // Airborne attack checks
    if (!fighter.isGrounded && fighter.state === 'jump_air') {
      if (buf.justPressed(INPUT.LP) || buf.justPressed(INPUT.RP)) {
        const jumpPunch = def.moves['jump_punch'] ?? def.moves['light_punch'];
        if (jumpPunch) {
          this.executeMove(fighter, jumpPunch);
          return;
        }
      }
      if (buf.justPressed(INPUT.LK) || buf.justPressed(INPUT.RK)) {
        const jumpKick = def.moves['jump_kick'] ?? def.moves['light_kick'];
        if (jumpKick) {
          this.executeMove(fighter, jumpKick);
          return;
        }
      }
    }

    // Handle jump startup & landing
    if (fighter.state === 'jump_start') {
      if (fighter.stateTicks >= 3) {
        fighter.state = 'jump_air';
        fighter.isGrounded = false;
        fighter.vy = def.jumpVelocity;

        // Directional jump
        if (buf.isDown(INPUT.LEFT)) {
          fighter.vx = -def.walkSpeedFwd;
        } else if (buf.isDown(INPUT.RIGHT)) {
          fighter.vx = def.walkSpeedFwd;
        }
      }
      return;
    }

    if (fighter.state === 'landing') {
      fighter.vx = 0;
      if (fighter.stateTicks >= 4) {
        fighter.state = 'idle';
      }
      return;
    }

    // Grounded neutral controls
    if (fighter.isGrounded) {
      if (buf.justPressed(INPUT.TECHNIQUE)) {
        const special = def.moves[def.specialMoveId];
        if (special && fighter.meter >= special.meterCost) {
          fighter.meter -= special.meterCost;
          this.executeMove(fighter, special);
          return;
        }
        this.events.push({
          type: 'meter_empty',
          tick: this.state.tick,
          data: { fighterId: fighter.id, currentMeter: fighter.meter },
        });
      }
      const holdingDown = buf.isDown(INPUT.DOWN);

      // 1. Crouch / Directional Attack Inputs
      if (holdingDown) {
        // Down + RP -> Uppercut / Podbródkowy (Classic Tekken Launcher)
        if (buf.justPressed(INPUT.RP)) {
          const uppercut = def.moves['uppercut'] ?? def.moves['heavy_punch'];
          if (uppercut) {
            this.executeMove(fighter, uppercut);
            return;
          }
        }
        // Down + RK -> Sweep / Niskie Podcięcie (Classic Low Knockdown)
        if (buf.justPressed(INPUT.RK)) {
          const sweep = def.moves['sweep'] ?? def.moves['heavy_kick'];
          if (sweep) {
            this.executeMove(fighter, sweep);
            return;
          }
        }
        // Down + LP -> Crouch Jab / Niski Prosty
        if (buf.justPressed(INPUT.LP)) {
          const crouchPunch = def.moves['crouch_punch'] ?? def.moves['light_punch'];
          if (crouchPunch) {
            this.executeMove(fighter, crouchPunch);
            return;
          }
        }
        // Down + LK -> Crouch Kick / Niskie Kopnięcie
        if (buf.justPressed(INPUT.LK)) {
          const crouchKick = def.moves['crouch_kick'] ?? def.moves['light_kick'];
          if (crouchKick) {
            this.executeMove(fighter, crouchKick);
            return;
          }
        }

        // Just holding down without attack button -> crouch stance
        fighter.state = buf.isDown(INPUT.BLOCK) ? 'block_low' : 'crouch';
        fighter.vx = 0;
        return;
      }

      // 2. Standing Attack Input Checks
      if (buf.justPressed(INPUT.SPECIAL)) {
        if (fighter.meter >= 100) {
          const ultMove = def.moves[def.ultimateMoveId] ?? def.moves[def.specialMoveId];
          if (ultMove) {
            this.executeMove(fighter, ultMove);
            fighter.meter = 0;
            return;
          }
        } else {
          this.events.push({
            type: 'meter_empty',
            tick: this.state.tick,
            data: { fighterId: fighter.id, currentMeter: fighter.meter },
          });
        }
      }

      if (buf.justPressed(INPUT.HP)) {
        this.executeMove(fighter, def.moves['heavy_punch']!);
        return;
      }
      if (buf.justPressed(INPUT.LP)) {
        this.executeMove(fighter, def.moves['light_punch']!);
        return;
      }
      if (buf.justPressed(INPUT.HK)) {
        this.executeMove(fighter, def.moves['heavy_kick']!);
        return;
      }
      if (buf.justPressed(INPUT.LK)) {
        this.executeMove(fighter, def.moves['light_kick']!);
        return;
      }

      if (buf.isDown(INPUT.BLOCK)) {
        fighter.stateTicks = 0;
        fighter.state = 'block_high';
        fighter.vx = 0;
        return;
      }

      // 3. Jump input check
      if (buf.justPressed(INPUT.UP)) {
        fighter.state = 'jump_start';
        fighter.stateTicks = 0;
        fighter.vx = 0;
        return;
      }

      // 4. Horizontal movement checks
      const movingRight = buf.isDown(INPUT.RIGHT);
      const movingLeft = buf.isDown(INPUT.LEFT);

      if (movingRight) {
        if (fighter.facing === 1) {
          fighter.state = 'walk_fwd';
          fighter.vx = def.walkSpeedFwd;
        } else {
          fighter.state = 'walk_back';
          fighter.vx = def.walkSpeedBack;
        }
      } else if (movingLeft) {
        if (fighter.facing === -1) {
          fighter.state = 'walk_fwd';
          fighter.vx = -def.walkSpeedFwd;
        } else {
          fighter.state = 'walk_back';
          fighter.vx = -def.walkSpeedBack;
        }
      } else {
        fighter.state = 'idle';
        fighter.vx = 0;
      }
    }
  }

  private executeMove(fighter: FighterState, move: MoveDefinition): void {
    if (move.id === 'ultimate') {
      this.state.superFreezeTicks = 48;
      this.state.superFreezeTotal = 48;
    }
    this.events.push({
      type: 'swing',
      tick: this.state.tick,
      data: { moveId: move.id, slot: fighter === this.state.p1 ? 1 : 2 },
    });
    fighter.state = 'attack';
    fighter.currentMove = move;
    fighter.moveTick = 0;
    fighter.stateTicks = 0;
    fighter.hasHit = false;
    fighter.vx = 0; // Grounded attacks halt horizontal sliding
  }

  private checkRoundEnd(): void {
    if (this.state.p1.hp <= 0 || this.state.p2.hp <= 0) {
      this.state.roundState = 'roundOver';
      this.state.stateTicks = 0;

      if (this.state.p1.hp <= 0 && this.state.p2.hp <= 0) {
        this.state.winner = 'draw';
      } else if (this.state.p1.hp <= 0) {
        this.state.winner = 2;
        this.state.p2Wins += 1;
        this.state.p2.state = 'victory';
        this.state.p1.state = 'defeat';
      } else {
        this.state.winner = 1;
        this.state.p1Wins += 1;
        this.state.p1.state = 'victory';
        this.state.p2.state = 'defeat';
      }

      this.events.push({
        type: 'ko',
        tick: this.state.tick,
        data: { winner: this.state.winner },
      });

      if (this.state.p1Wins >= 2 || this.state.p2Wins >= 2) {
        this.state.roundState = 'matchOver';
      }
    }
  }

  private endRoundByTimeout(): void {
    this.state.roundState = 'roundOver';
    this.state.stateTicks = 0;

    if (this.state.p1.hp > this.state.p2.hp) {
      this.state.winner = 1;
      this.state.p1Wins += 1;
      this.state.p1.state = 'victory';
      this.state.p2.state = 'defeat';
    } else if (this.state.p2.hp > this.state.p1.hp) {
      this.state.winner = 2;
      this.state.p2Wins += 1;
      this.state.p2.state = 'victory';
      this.state.p1.state = 'defeat';
    } else {
      this.state.winner = 'draw';
    }

    if (this.state.p1Wins >= 2 || this.state.p2Wins >= 2) {
      this.state.roundState = 'matchOver';
    }
  }

  private nextRound(): void {
    this.state.roundNumber += 1;
    this.state.roundTimer = 90.0;
    this.state.roundState = 'fight';
    this.state.stateTicks = 0;

    // Reset positions and health
    this.state.p1 = this.createFighterState(this.def1, 1, -180);
    this.state.p2 = this.createFighterState(this.def2, -1, 180);
    this.buffer1.clear();
    this.buffer2.clear();

    this.events.push({
      type: 'round_start',
      tick: this.state.tick,
      data: { round: this.state.roundNumber },
    });
  }

  restartMatch(): void {
    this.state = this.createInitialState();
    this.buffer1.clear();
    this.buffer2.clear();
    this.events = [];
  }

  getSnapshot(): MatchSnapshot {
    return {
      ...JSON.parse(JSON.stringify(this.state)),
      inputHistory: [this.buffer1.snapshot(), this.buffer2.snapshot()],
    };
  }

  loadSnapshot(snapshot: MatchSnapshot): void {
    const next = JSON.parse(JSON.stringify(snapshot));
    for (const key of Object.keys(this.state)) {
      if (!(key in next)) Reflect.deleteProperty(this.state, key);
    }
    // Preserve actor identity for presentation effects bound to a player slot.
    for (const actor of ['p1', 'p2'] as const) {
      for (const key of Object.keys(this.state[actor])) {
        if (!(key in next[actor])) Reflect.deleteProperty(this.state[actor], key);
      }
    }
    Object.assign(this.state.p1, next.p1);
    Object.assign(this.state.p2, next.p2);
    Object.assign(this.state, { ...next, p1: this.state.p1, p2: this.state.p2 });
    this.buffer1.restore(snapshot.inputHistory?.[0] ?? []);
    this.buffer2.restore(snapshot.inputHistory?.[1] ?? []);
    delete (this.state as MatchSnapshot).inputHistory;
    this.events = [];
  }
}
