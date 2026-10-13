import { describe, expect, it } from 'vitest';
import { FighterSimulation } from './FighterSimulation';
import { INPUT } from './CombatTypes';
import { combatMove } from './combatTiming';
import { checkHit, getFighterHurtbox } from './CombatResolver';
import { ROSTER } from '../data/fighters/roster';
import { STAGE_HALF_WIDTH, resolvePushboxes, updatePhysics } from './Movement';
import { stageLayout } from '../presentation/stageLayout';
import { STAGES } from '../data/stages';
import { ultimatePropPose } from '../presentation/SuperPropsRenderer';
import { locomotionPose } from '../presentation/locomotion';

describe('art polish shared gameplay and presentation', () => {
  it('gives every ultimate full-arena ground and air coverage in either facing, with guard and invulnerability intact', () => {
    for (const { definition: def } of Object.values(ROSTER)) {
      for (const facing of [1, -1] as const)
        for (const airborne of [false, true]) {
          const { p1, p2 } = new FighterSimulation(def, def).getState();
          const move = combatMove(def.moves.ultimate);
          Object.assign(p1, {
            x: -550 * facing,
            facing,
            state: 'attack',
            currentMove: move,
            moveTick: move.startup + 1,
          });
          Object.assign(p2, {
            x: 550 * facing,
            facing: -facing,
            y: airborne ? 250 : 0,
            isGrounded: !airborne,
          });
          const hit = checkHit(p1, def, p2, def, 0)!;
          expect(hit.hit, def.id).toBe(true);
          const hurtbox = getFighterHurtbox(p2, def);
          expect(hit.point.x).toBeGreaterThanOrEqual(hurtbox.x);
          expect(hit.point.x).toBeLessThanOrEqual(hurtbox.x + hurtbox.w);
          expect(hit.point.y).toBeGreaterThanOrEqual(hurtbox.y);
          expect(hit.point.y).toBeLessThanOrEqual(hurtbox.y + hurtbox.h);
          expect(checkHit(p1, def, p2, def, 0)).toBeNull();
          p1.hasHit = false;
          Object.assign(p2, { state: 'idle', y: 0, isGrounded: true });
          expect(checkHit(p1, def, p2, def, INPUT.BLOCK)?.blocked).toBe(true);
          p1.hasHit = false;
          p2.state = 'get_up';
          expect(checkHit(p1, def, p2, def, 0)).toBeNull();
        }
    }
  });

  it('never KOs the training dummy, including overkill, and allows repeat ultimates without a timer', () => {
    const def = ROSTER.amper.definition;
    const sim = new FighterSimulation(def, def, { training: true });
    const state = sim.getState();
    expect(state.p1.meter).toBe(100);
    state.p2.maxHp = 1;
    let hits = 0;
    for (let tick = 0; tick < 6000; tick++) {
      state.p2.hp = 1;
      const input = tick % 240 === 0 ? INPUT.SPECIAL : 0;
      sim.update(input, 0);
      hits += sim.getEvents().filter((e) => ['hit', 'launch'].includes(e.type)).length;
      expect(state.p1.meter).toBe(100);
      // During a freeze, no combat executes; otherwise dummy HP is restored before round checking.
      if (!(state.superFreezeTicks ?? 0)) expect(state.p2.hp).toBe(state.p2.maxHp);
      expect(state.roundState).toBe('fight');
    }
    expect(hits).toBeGreaterThan(2);
    expect(state.roundTimer).toBe(90);
    expect(state.p1Wins + state.p2Wins).toBe(0);
    const normal = new FighterSimulation(def, def);
    for (let i = 0; i < 60; i++) normal.update(0, 0);
    expect(normal.getState().roundTimer).toBe(89);
    expect(normal.getState().p1.meter).toBe(0);
  });

  it('covers every viewport at the arena edges and all supported zooms, keeping the floor aligned', () => {
    for (const stage of Object.values(STAGES))
      for (const [width, height] of [
        [360, 800],
        [844, 390],
        [1920, 1080],
      ]) {
        for (const zoom of [0.82, 1, 1.22])
          for (const cameraX of [-600, 0, 600]) {
            const r = stageLayout(width, height, zoom, cameraX, 9 / 16, stage.groundOffsetRatio);
            for (const shakeX of [-32, 0, 32])
              for (const shakeY of [-32, 0, 32]) {
                const screenLeft = width / 2 + (r.x - cameraX) * zoom + shakeX;
                expect(screenLeft).toBeLessThanOrEqual(0.001);
                expect(screenLeft + r.width * zoom).toBeGreaterThanOrEqual(width - 0.001);
                expect(r.groundY + shakeY + r.y * zoom).toBeLessThanOrEqual(0.001);
                expect(r.groundY + shakeY + (r.y + r.height) * zoom).toBeGreaterThanOrEqual(height - 0.001);
                expect(r.y + r.aboveGround).toBeCloseTo(0);
              }
          }
      }
  });

  it('keeps pushboxes inside walls during movement, flight and wall separation', () => {
    const def = ROSTER.amper.definition;
    const { p1, p2 } = new FighterSimulation(def, def).getState();
    for (const side of [-1, 1])
      for (const y of [0, 90]) {
        Object.assign(p1, { x: side * 590, vx: side * 50, y, isGrounded: y === 0 });
        Object.assign(p2, { x: side * 590, vx: side * 50, y, isGrounded: y === 0 });
        updatePhysics(p1, def);
        updatePhysics(p2, def);
        resolvePushboxes(p1, def, p2, def);
        for (const p of [p1, p2])
          expect(Math.abs(p.x) + def.pushbox.w / 2).toBeLessThanOrEqual(STAGE_HALF_WIDTH);
      }
  });

  it('shows each prop at the target when combat becomes active, including the overhead HIPOKRISTIS sticker', () => {
    for (const id of Object.keys(ROSTER)) {
      const start = ultimatePropPose(35, -550, 0, 550, 80, id);
      const contact = ultimatePropPose(76, -550, 0, 550, 80, id);
      expect(start.x).toBe(-550);
      expect(contact.x).toBe(550);
      expect(contact.y).toBe(-145);
    }
    expect(ultimatePropPose(35, 0, 0, 500, 0, 'szerszen').y).toBe(-175);
  });

  it('uses start and stop poses, follows distance, freezes and immediately yields to combat', () => {
    const f = new FighterSimulation(ROSTER.amper.definition, ROSTER.amper.definition).getState().p1;
    let pose = locomotionPose(undefined, f, 0);
    f.state = 'walk_fwd';
    pose = locomotionPose(pose, f, 1);
    expect(pose.clip).toBe('walk_start');
    for (let tick = 2; tick <= 10; tick++) {
      f.x += 3;
      pose = locomotionPose(pose, f, tick);
    }
    expect(pose.clip).toBe('walk');
    const frozen = locomotionPose(pose, f, 100, true);
    expect(frozen.phase).toBe(pose.phase);
    expect(frozen.elapsed).toBe(pose.elapsed);
    f.state = 'idle';
    pose = locomotionPose(frozen, f, 101);
    expect(pose.clip).toBe('walk_stop');
    f.state = 'attack';
    pose = locomotionPose(pose, f, 102);
    expect(pose.clip).toBe('idle');
  });
});
