import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import motion from '../../../../public/game-assets/2d/fighter/motion-v4/manifest.json';
import { ROSTER, ROSTER_KEYS } from '../data/fighters/roster';
import { FighterSimulation } from '../simulation/FighterSimulation';
import { combatMove } from '../simulation/combatTiming';
import { SuperCinematicEngine } from './SuperCinematicEngine';
import { SuperPropsRenderer } from './SuperPropsRenderer';
import {
  cinematicTick,
  djConsolePose,
  floatingCabin,
  REDRAWN_ULTIMATES,
  ultimateBodyPose,
  ultimateFrame,
  ultimateProjectiles,
  vehicleStageX,
} from './ultimateChoreography';
import { locomotionPose } from './locomotion';
import { fightFraming } from './stageLayout';

describe('authored motion and ultimate choreography', () => {
  it('places the human-sized DJ desk beside the operator, grounded and facing them', () => {
    for (const facing of [1, -1]) {
      const deck = djConsolePose(200, 15, facing);
      expect((deck.x - 200) * facing - deck.width / 2).toBeGreaterThan(30);
      expect(deck.y + deck.height / 2).toBe(-15);
      expect(deck.height).toBeLessThan(140);
      expect(deck.facing).toBe(facing);
    }
  });
  it('opens the overhead cabin before emitting paper and sends the vehicle across the entire stage', () => {
    expect([35, 46, 52, 58].map((t) => floatingCabin(t, 0, 0, 1).frame)).toEqual([0, 1, 2, 3]);
    expect(floatingCabin(58, 0, 0, 1).y + 110).toBeLessThan(-140);
    for (const facing of [1, -1]) {
      const cabin = floatingCabin(58, 100, 0, facing);
      expect(cabin.facing).toBe(1);
      expect(cabin.propId).toBe(facing > 0 ? 'gruczol_right' : 'gruczol');
      expect(cabin.outletX).toBe(100 + 20 * facing);
      expect(cabin.outletY).toBeLessThan(-140);
      expect(vehicleStageX(43, facing, 200 * facing) * facing).toBeLessThan(-600);
      expect(vehicleStageX(76, facing, 200 * facing) + 220 * facing).toBe(200 * facing);
      expect(vehicleStageX(105, facing, 200 * facing) * facing).toBeGreaterThan(600);
    }
    expect(ROSTER.szerszen.definition.moves.ultimate.name).toBe('Wyrok Hipokristis');
  });

  it('keeps both fighters and their props inside narrow screens even while the camera catches up', () => {
    for (const width of [320, 390, 844, 1440]) {
      for (const [p1, p2] of [
        [-470, 230],
        [470, -230],
        [-30, 30],
      ]) {
        const frame = fightFraming(width, 1.22, 0, p1, p2);
        for (const x of [Math.min(p1, p2) - 230, Math.max(p1, p2) + 230]) {
          const screenX = width / 2 + (x - frame.x) * frame.zoom;
          expect(screenX).toBeGreaterThanOrEqual(31.99);
          expect(screenX).toBeLessThanOrEqual(width - 31.99);
        }
      }
    }
  });
  it('ships new walking, knockdown and get-up art for every fighter, and the eleven requested ultimates', () => {
    expect(Object.keys(motion.fighters).sort()).toEqual([...ROSTER_KEYS].sort());
    for (const [id, clips] of Object.entries(motion.fighters)) {
      expect(clips.walk.frames).toBe(8);
      expect(clips.fall.frames).toBe(4);
      expect(clips.get_up.frames).toBe(4);
      expect('ultimate' in clips).toBe(REDRAWN_ULTIMATES.has(id));
      for (const clip of Object.values(clips)) {
        const png = readFileSync(`public/game-assets/2d/fighter/motion-v4/${id}/${clip.file}`);
        expect(png.readUInt32BE(16)).toBe(clip.frames * clip.size);
        expect(png.readUInt32BE(20)).toBe(clip.size);
        expect(clip.worldSize).toBe(clips.walk.worldSize);
        expect(clip.pivot).toEqual([0.5, 230 / 256]);
      }
    }
  });

  it('advances a complete gait by distance and holds its phase during hitstop', () => {
    const sim = new FighterSimulation(ROSTER.amper.definition, ROSTER.korba.definition);
    const fighter = sim.getState().p1;
    fighter.state = 'walk_fwd';
    fighter.x = 0;
    const start = locomotionPose(undefined, fighter, 0);
    fighter.x = 20;
    const first = locomotionPose(start, fighter, 3);
    fighter.x = 40;
    const second = locomotionPose(first, fighter, 6);
    fighter.x = 60;
    const half = locomotionPose(second, fighter, 9);
    expect(half.phase).toBe(6);
    fighter.x = 120;
    const frozen = locomotionPose(half, fighter, 10, true);
    expect(frozen.phase).toBe(half.phase);
    fighter.state = 'idle';
    expect(locomotionPose(half, fighter, 11).clip).toBe('walk_stop');
  });

  it('shows two fans of three lighters and ten alternating pinecones without changing damage', () => {
    const lighters = ultimateProjectiles('jeczmien', 66);
    expect(lighters).toHaveLength(6);
    expect(lighters.filter((p) => p.hand === 0)).toHaveLength(3);
    expect(lighters.filter((p) => p.hand === 1)).toHaveLength(3);
    expect(new Set(lighters.map((p) => p.release)).size).toBe(2);
    const cones = ultimateProjectiles('ambona', 64);
    expect(cones).toHaveLength(10);
    expect(cones.map((p) => p.hand)).toEqual([0, 1, 0, 1, 0, 1, 0, 1, 0, 1]);
    for (const id of ['ambona', 'jeczmien', 'antena', 'zawor']) {
      const move = combatMove(ROSTER[id].definition.moves.ultimate);
      expect(move.damage).toBe(275);
      expect(move.meterCost).toBe(100);
    }
  });

  it('keeps approach, double kick, landing, standing and eating in order for both facings', () => {
    expect([43, 60, 76, 88, 94, 99, 103].map((t) => ultimateFrame('zawor', t))).toEqual([
      1, 2, 3, 4, 5, 6, 7,
    ]);
    for (const facing of [1, -1]) {
      const start = -200 * facing,
        target = 200 * facing;
      expect(ultimateBodyPose('antena', 35, start, 0, target, facing).x).toBe(start);
      expect(ultimateBodyPose('antena', 76, start, 0, target, facing).x).toBe(target - facing * 30);
      expect(ultimateBodyPose('antena', 105, start, 0, target, facing).x).toBe(start);
    }
  });

  it('shares startup/contact/recovery timing with authoritative combat ticks', () => {
    const state = new FighterSimulation(ROSTER.zawor.definition, ROSTER.korba.definition).getState();
    const f = state.p1;
    f.currentMove = combatMove(ROSTER.zawor.definition.moves.ultimate);
    f.moveTick = f.currentMove.startup;
    expect(cinematicTick(f)).toBe(75);
    f.moveTick++;
    expect(cinematicTick(f)).toBe(76);
    state.superFreezeTicks = state.superFreezeTotal = 48;
    expect(cinematicTick(f, state)).toBe(0);
  });

  it('replaces shared waves with the disc, mouth text, speaker text and megaphone rings', () => {
    const props = vi.spyOn(SuperPropsRenderer.prototype, 'drawProp').mockImplementation(() => {});
    try {
      for (const id of ['chlebak', 'klatwa', 'pierscien', 'pien']) {
        const state = new FighterSimulation(ROSTER[id].definition, ROSTER.korba.definition).getState();
        const engine = new SuperCinematicEngine();
        engine.startCinematic(state.p1, state.p2, 'ultimate', 'ulti', id, {} as HTMLImageElement, '#fff');
        Object.assign(engine.getActiveState()!, { currentTick: 76, phase: 'impact' });
        const ctx = new Proxy(
          { globalAlpha: 1 },
          { get: (obj, key) => (key in obj ? obj[key as keyof typeof obj] : vi.fn()), set: () => true },
        ) as unknown as CanvasRenderingContext2D;
        props.mockClear();
        engine.render(ctx, 1000, 700);
        expect(props.mock.calls.some((call) => call[1] === 'soundwave')).toBe(false);
        if (id === 'chlebak') expect(props.mock.calls.some((call) => call[1] === 'vinyl')).toBe(true);
        if (id === 'klatwa' || id === 'pierscien')
          expect(props).not.toHaveBeenCalledWith(ctx, 'soundwave', expect.anything());
        engine.reset();
        expect(engine.getActiveState()).toBeNull();
      }
    } finally {
      props.mockRestore();
    }
  });
});
