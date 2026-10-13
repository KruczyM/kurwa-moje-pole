import { Box, FighterDefinition, FighterState, MoveDefinition, INPUT } from './CombatTypes';

export function boxesIntersect(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function getFighterHurtbox(fighter: FighterState, def: FighterDefinition): Box {
  const baseBox = !fighter.isGrounded
    ? def.hurtboxAir
    : fighter.state === 'crouch' || fighter.state === 'block_low'
      ? def.hurtboxCrouch
      : def.hurtboxStand;

  // Convert to world coordinates
  const worldX = fighter.facing === 1 ? fighter.x + baseBox.x : fighter.x - (baseBox.x + baseBox.w);

  return {
    x: worldX,
    y: fighter.y + baseBox.y,
    w: baseBox.w,
    h: baseBox.h,
  };
}

export function getMoveHitboxes(fighter: FighterState, move: MoveDefinition): Box[] {
  return move.hitboxes.map((b) => {
    const worldX = fighter.facing === 1 ? fighter.x + b.x : fighter.x - (b.x + b.w);

    return {
      x: worldX,
      y: fighter.y + b.y,
      w: b.w,
      h: b.h,
    };
  });
}

export interface HitResult {
  hit: boolean;
  blocked: boolean;
  damage: number;
  hitstop: number;
  pushback: number;
  comboHits: number;
  hitHeight: 'high' | 'mid' | 'low';
  point: { x: number; y: number };
  isLauncher?: boolean;
  isAirJuggle?: boolean;
  moveId?: string;
  attackerId?: string;
  defenderId?: string;
  causesKnockdown?: boolean;
}

/** Evaluate both strikes against the same tick, so P1 has no implicit priority. */
export function resolveCombatPair(
  p1: FighterState,
  def1: FighterDefinition,
  p2: FighterState,
  def2: FighterDefinition,
  input1: number,
  input2: number,
): [HitResult | null, HitResult | null] {
  const attack1 = { ...p1 };
  const defend2 = { ...p2 };
  const attack2 = { ...p2 };
  const defend1 = { ...p1 };
  const hit1 = checkHit(attack1, def1, defend2, def2, input2);
  const hit2 = checkHit(attack2, def2, defend1, def1, input1);
  if (hit1 && hit2) {
    const meter1 = Math.min(100, defend1.meter + attack1.meter - p1.meter);
    const meter2 = Math.min(100, defend2.meter + attack2.meter - p2.meter);
    Object.assign(p1, defend1, { meter: meter1, hitstop: Math.max(defend1.hitstop, attack1.hitstop) });
    Object.assign(p2, defend2, { meter: meter2, hitstop: Math.max(defend2.hitstop, attack2.hitstop) });
  } else if (hit1) {
    Object.assign(p1, attack1);
    Object.assign(p2, defend2);
  } else if (hit2) {
    Object.assign(p2, attack2);
    Object.assign(p1, defend1);
  }
  return [hit1, hit2];
}

export function checkHit(
  attacker: FighterState,
  attDef: FighterDefinition,
  defender: FighterState,
  defDef: FighterDefinition,
  defenderInputMask: number,
): HitResult | null {
  if (attacker.state !== 'attack' || !attacker.currentMove || attacker.hasHit) return null;
  const move = attacker.currentMove;

  // Hitbox is active only during startup < moveTick <= startup + active
  const isActive = attacker.moveTick > move.startup && attacker.moveTick <= move.startup + move.active;

  if (!isActive) return null;

  // Can't hit if defender is in invincible get_up or already dead
  if (defender.state === 'get_up' || defender.state === 'knockdown' || defender.hp <= 0) return null;
  if (!defender.isGrounded && (defender.juggleHits ?? 0) >= 3) return null;

  const hitboxes = getMoveHitboxes(attacker, move);
  const hurtbox = getFighterHurtbox(defender, defDef);

  let collisionBox: Box | null = null;
  for (const hb of hitboxes) {
    if (boxesIntersect(hb, hurtbox)) {
      collisionBox = hb;
      break;
    }
  }

  if (!collisionBox) return null;

  // Determine if defender is blocking
  // Defender blocks by holding backward or by pressing the BLOCK button
  const holdingBack =
    defender.facing === 1 ? (defenderInputMask & INPUT.LEFT) !== 0 : (defenderInputMask & INPUT.RIGHT) !== 0;

  const holdingBlockButton = (defenderInputMask & INPUT.BLOCK) !== 0;
  const canGuard = ['idle', 'walk_fwd', 'walk_back', 'crouch', 'block_high', 'block_low'].includes(
    defender.state,
  );
  const isBlocking = (holdingBack || holdingBlockButton) && defender.isGrounded && canGuard;
  // DOWN cannot shrink the hurtbox/duck a high while an attack or hit reaction locks posture.
  const isCrouching =
    defender.state === 'crouch' ||
    defender.state === 'block_low' ||
    (canGuard && (defender.stunTicks ?? 0) === 0 && (defenderInputMask & INPUT.DOWN) !== 0);

  // High attacks whiff over crouching opponents (classic Tekken ducking mechanic)
  if (move.attackHeight === 'high' && (isCrouching || defender.state === 'block_low')) {
    return null;
  }

  attacker.hasHit = true;

  let blocked = false;
  if (isBlocking) {
    if (move.attackHeight === 'mid') {
      // Classic Tekken mid rule: Mid attacks can ONLY be blocked standing!
      // Crouching opponents get hit and cannot block mid attacks.
      blocked = !isCrouching;
    } else if (move.attackHeight === 'high') {
      // High attacks can be blocked standing
      blocked = !isCrouching;
    } else if (move.attackHeight === 'low') {
      // Low attacks can ONLY be blocked crouching! Standing blocks get swept!
      blocked = isCrouching;
    }
  }

  // Calculate damage with combo scaling
  let damage: number;
  let isLauncher = false;
  let isAirJuggle = false;

  if (blocked) {
    damage = Math.max(1, Math.floor(move.damage * 0.1)); // 10% chip damage
    defender.state = isCrouching ? 'block_low' : 'block_high';
    defender.stateTicks = 0;
    defender.stunTicks = move.blockstun;
    defender.vx = attacker.facing * move.pushback * 0.6;
  } else {
    // Combo scaling: -10% per subsequent hit in combo down to 30% min
    const scaling = Math.max(0.3, 1.0 - defender.comboHits * 0.1);
    damage = Math.floor(move.damage * scaling);

    defender.comboHits += 1;
    defender.lastHitBy = move.id;

    if (move.launcher) {
      // Uppercut / Launcher: pops opponent high into the air!
      isLauncher = true;
      defender.state = 'hit_stun';
      defender.vy = move.launchVelocityY ?? 15.5;
      defender.vx = (attacker.facing === 1 ? 1 : -1) * (move.launchVelocityX ?? 2.5);
      defender.isGrounded = false;
      defender.isAirJuggle = true;
      defender.juggleHits = (defender.juggleHits ?? 0) + 1;
      defender.stateTicks = 0;
    } else if (!defender.isGrounded) {
      // Opponent is already in the air (being juggled!)
      isAirJuggle = true;
      defender.state = 'hit_stun';
      defender.vy = Math.min(10, Math.max(4, defender.vy + 3));
      defender.vx = (attacker.facing === 1 ? 1 : -1) * Math.min(2.5, move.pushback * 0.4);
      defender.isAirJuggle = true;
      defender.juggleHits = (defender.juggleHits ?? 0) + 1;
      defender.stateTicks = 0;
    } else if (move.causesKnockdown || (move.attackHeight === 'low' && move.id.includes('sweep'))) {
      // Sweep or knockdown move: sweeps opponent down to ground
      defender.state = 'knockdown';
      defender.stateTicks = 0;
      defender.vy = 0;
      defender.vx = attacker.facing * move.pushback * 0.7;
      defender.isGrounded = true;
      defender.isAirJuggle = false;
    } else {
      // Regular grounded hit
      defender.state = 'hit_stun';
      defender.stateTicks = 0;
      defender.vx = attacker.facing * move.pushback;
    }
  }

  if (!blocked) defender.stunTicks = move.hitstun;
  defender.lastHitHeight = move.attackHeight;
  // Cancel interrupted attacks, including their not-yet-active hitboxes.
  defender.currentMove = null;
  defender.moveTick = 0;
  defender.hasHit = false;

  // Apply hitstop to both players for punch impact feel
  attacker.hitstop = move.hitstop;
  defender.hitstop = move.hitstop;

  // Apply HP reduction
  defender.hp = Math.max(0, defender.hp - damage);

  // Meter build
  if (!blocked) {
    attacker.meter = Math.min(100, attacker.meter + move.meterGain * 1.6);
    defender.meter = Math.min(100, defender.meter + 6);
  } else {
    attacker.meter = Math.min(100, attacker.meter + move.meterGain * 0.65);
    defender.meter = Math.min(100, defender.meter + 3);
  }

  return {
    hit: true,
    blocked,
    damage,
    hitstop: move.hitstop,
    pushback: move.pushback,
    comboHits: defender.comboHits,
    hitHeight: move.attackHeight,
    isLauncher,
    isAirJuggle,
    moveId: move.id,
    attackerId: attacker.id,
    defenderId: defender.id,
    causesKnockdown: Boolean(
      move.causesKnockdown || (move.attackHeight === 'low' && move.id.includes('sweep')),
    ),
    point: {
      x: (collisionBox.x + collisionBox.w / 2 + hurtbox.x + hurtbox.w / 2) / 2,
      y: (collisionBox.y + collisionBox.h / 2 + hurtbox.y + hurtbox.h / 2) / 2,
    },
  };
}
