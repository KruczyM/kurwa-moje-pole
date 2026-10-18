import { FighterState, INPUT } from '../simulation/CombatTypes';

export type BotDifficulty = 'easy' | 'normal' | 'hard';

export class BotController {
  private readonly difficulty: BotDifficulty;
  private actionCooldown = 0;
  private currentMask = 0;

  constructor(
    difficulty: BotDifficulty = 'normal',
    private readonly random: () => number = Math.random,
  ) {
    this.difficulty = difficulty;
  }

  update(self: FighterState, opponent: FighterState): number {
    // Do not queue held attacks during recovery/stun. Every strike needs a fresh edge.
    if (
      self.hp <= 0 ||
      opponent.hp <= 0 ||
      self.hitstop > 0 ||
      ['attack', 'hit_stun', 'knockdown', 'get_up', 'victory', 'defeat', 'jump_start', 'landing'].includes(
        self.state,
      )
    ) {
      this.currentMask = 0;
      this.actionCooldown = Math.max(this.actionCooldown, 3);
      return 0;
    }
    if (this.actionCooldown > 0) {
      this.actionCooldown -= 1;
      // Directions and guard may be held, attack/jump buttons are one-tick pulses.
      return this.currentMask & (INPUT.LEFT | INPUT.RIGHT | INPUT.DOWN | INPUT.BLOCK);
    }

    let mask: number;
    const dist = Math.abs(opponent.x - self.x);
    const isFacingRight = self.x < opponent.x;

    if (!self.isGrounded) {
      this.actionCooldown = 12;
      this.currentMask = dist < 105 ? INPUT.RK : isFacingRight ? INPUT.RIGHT : INPUT.LEFT;
      return this.currentMask;
    }

    // Reaction to opponent attack (Blocking)
    if (opponent.state === 'attack' && opponent.currentMove) {
      const blockChance = this.difficulty === 'hard' ? 0.85 : this.difficulty === 'normal' ? 0.6 : 0.25;

      if (dist < 120 && this.random() < blockChance) {
        // Hold away from opponent
        const backDir = INPUT.BLOCK;
        if (opponent.currentMove.attackHeight === 'low') {
          mask = backDir | INPUT.DOWN;
        } else {
          mask = backDir;
        }
        this.currentMask = mask;
        this.actionCooldown = 8;
        return mask;
      }
    }

    // Offensive behaviors based on distance
    if (dist < 70) {
      // Close range: Melee combat mixup
      const roll = this.random();
      if (self.meter >= 100 && roll < 0.25) {
        // Ultimate
        mask = INPUT.SPECIAL;
      } else if (self.meter >= 30 && roll < 0.3) {
        mask = INPUT.TECHNIQUE;
      } else if (roll < 0.35) {
        // Light Punch (quick jab)
        mask = INPUT.LP;
      } else if (roll < 0.6) {
        // Light Kick (low poke)
        mask = INPUT.LK | INPUT.DOWN;
      } else if (roll < 0.8) {
        // Heavy Punch
        mask = this.random() < 0.3 ? INPUT.DOWN | INPUT.RP : INPUT.HP;
      } else if (roll < 0.9) {
        // Heavy Kick
        mask = INPUT.HK;
      } else {
        // Step back
        mask = isFacingRight ? INPUT.LEFT : INPUT.RIGHT;
      }
      this.actionCooldown = this.difficulty === 'hard' ? 5 : 10;
    } else if (dist < 220) {
      // Mid range: approach or special move
      const roll = this.random();
      if (roll < 0.85) {
        // Walk forward
        mask = isFacingRight ? INPUT.RIGHT : INPUT.LEFT;
        this.actionCooldown = 8;
      } else {
        // Jump in
        mask = INPUT.UP | (isFacingRight ? INPUT.RIGHT : INPUT.LEFT);
        this.actionCooldown = 12;
      }
    } else {
      // Long range: Advance towards opponent
      mask = isFacingRight ? INPUT.RIGHT : INPUT.LEFT;
      if (this.random() < 0.12) {
        // Jump forward
        mask |= INPUT.UP;
      }
      this.actionCooldown = 12;
    }

    this.currentMask = mask;
    return mask;
  }
}
