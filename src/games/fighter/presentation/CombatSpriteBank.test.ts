import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { CombatSpriteBank, combatClip, combatFrame } from './CombatSpriteBank';
import { FighterSimulation } from '../simulation/FighterSimulation';
import { amperDefinition } from '../data/fighters/amper';
import { INPUT } from '../simulation/CombatTypes';
import { ROSTER } from '../data/fighters/roster';

describe('combat sprite phase mapping', () => {
  it('renders the real uppercut trajectory through launch and landing', () => {
    const sim = new FighterSimulation(amperDefinition, amperDefinition);
    const { p1, p2 } = sim.getState();
    p1.x = -25;
    p2.x = 25;
    sim.update(INPUT.DOWN | INPUT.RP, 0);
    for (let tick = 0; tick < 90 && !p2.isAirJuggle; tick++) sim.update(0, 0);
    expect(p2.isAirJuggle).toBe(true);
    const phases = new Set<number>();
    for (let tick = 0; tick < 100 && p2.state !== 'knockdown'; tick++) {
      expect(combatClip(p2)).toBe('launch_hit');
      phases.add(combatFrame(p2, 6, 48));
      sim.update(0, 0);
    }
    expect([...phases].sort()).toEqual([0, 1, 2, 3, 4, 5]);
    expect(p2.isGrounded).toBe(true);
    expect(combatClip(p2)).toBe('fall');
  });
  it('uses different clips for punch, kick, hit, guard and get-up', () => {
    const fighter = new FighterSimulation(amperDefinition, amperDefinition).getState().p1;
    for (const [state, clip] of [
      ['idle', 'idle'],
      ['walk_fwd', 'walk'],
      ['crouch', 'crouch'],
      ['get_up', 'get_up'],
      ['block_high', 'block'],
      ['block_low', 'block_low'],
      ['knockdown', 'fall'],
    ] as const) {
      fighter.state = state;
      expect(combatClip(fighter)).toBe(clip);
    }
    fighter.state = 'hit_stun';
    fighter.lastHitHeight = 'high';
    expect(combatClip(fighter)).toBe('hit_head');
    fighter.lastHitHeight = 'mid';
    expect(combatClip(fighter)).toBe('hit_body');
  });
  it('progresses anticipation, contact and recovery instead of looping the attack pose', () => {
    const sim = new FighterSimulation(amperDefinition, amperDefinition);
    sim.update(INPUT.RP, 0);
    const fighter = sim.getState().p1;
    const move = fighter.currentMove!;
    expect(combatClip(fighter)).toBe('cross');
    expect(combatFrame(fighter, 6, 60)).toBe(0);
    fighter.moveTick = move.startup + 1;
    expect(combatFrame(fighter, 6, 60)).toBeGreaterThanOrEqual(2);
    fighter.moveTick = move.startup + move.active + move.recovery;
    expect(combatFrame(fighter, 6, 60)).toBe(5);
  });
  it('fall holds the last frame and get-up finishes at standing frame', () => {
    const fighter = new FighterSimulation(amperDefinition, amperDefinition).getState().p1;
    fighter.state = 'knockdown';
    fighter.stateTicks = 1000;
    expect(combatFrame(fighter, 6, 60)).toBe(5);
    fighter.state = 'get_up';
    fighter.stateTicks = 35;
    expect(combatFrame(fighter, 6, 60)).toBe(5);
  });
  it('gives every roster move its own correct clip', () => {
    const clips: Record<string, string> = {
      light_punch: 'jab',
      heavy_punch: 'cross',
      light_kick: 'kick',
      heavy_kick: 'heavy_kick',
      uppercut: 'uppercut',
      sweep: 'sweep',
      crouch_punch: 'crouch_punch',
      crouch_kick: 'crouch_kick',
      jump_punch: 'jump_punch',
      jump_kick: 'air_kick',
      special: 'special',
      ultimate: 'ultimate',
    };
    for (const { definition } of Object.values(ROSTER)) {
      const fighter = new FighterSimulation(definition, definition).getState().p1;
      fighter.state = 'attack';
      for (const move of Object.values(definition.moves)) {
        fighter.currentMove = move;
        expect(combatClip(fighter), `${definition.id}/${move.id}`).toBe(clips[move.id]);
        for (let tick = 0; tick <= move.startup + move.active + move.recovery; tick++) {
          fighter.moveTick = tick;
          const frame = combatFrame(fighter, 6, 48);
          if (tick <= move.startup) expect(frame).toBeLessThan(2);
          else if (tick <= move.startup + move.active) {
            expect(frame).toBeGreaterThanOrEqual(2);
            expect(frame).toBeLessThan(4);
          } else expect(frame).toBeGreaterThanOrEqual(4);
        }
      }
    }
  });
  it('holds the braced high and low guard, without exposing recovery poses', () => {
    const fighter = new FighterSimulation(amperDefinition, amperDefinition).getState().p1;
    for (const state of ['block_high', 'block_low'] as const) {
      fighter.state = state;
      for (const tick of [0, 1, 3, 47, 48, 120, 1000]) {
        fighter.stateTicks = tick;
        expect(combatFrame(fighter, 6, 48)).toBe(2);
      }
    }
  });
  it('braces while the simulation resets its held-guard state counter', () => {
    for (const input of [INPUT.BLOCK, INPUT.BLOCK | INPUT.DOWN]) {
      const sim = new FighterSimulation(amperDefinition, amperDefinition);
      for (let tick = 0; tick < 60; tick++) {
        sim.update(input, 0);
        const fighter = sim.getState().p1;
        expect(fighter.state).toBe(input & INPUT.DOWN ? 'block_low' : 'block_high');
        expect(combatFrame(fighter, 6, 48)).toBe(2);
      }
    }
  });
  it('reacts immediately to a hit and recovers without looping', () => {
    const fighter = new FighterSimulation(amperDefinition, amperDefinition).getState().p1;
    fighter.state = 'hit_stun';
    let previous = 2;
    for (let tick = 0; tick < 30; tick++) {
      fighter.stateTicks = tick;
      fighter.stunTicks = 30 - tick;
      const frame = combatFrame(fighter, 6, 48);
      expect(frame).toBeGreaterThanOrEqual(previous);
      previous = frame;
    }
    expect(previous).toBe(5);
  });
  it('uses articulated launch phases from physics and switches to fall on landing', () => {
    const fighter = new FighterSimulation(amperDefinition, amperDefinition).getState().p1;
    Object.assign(fighter, { state: 'hit_stun', isAirJuggle: true, isGrounded: false });
    expect(combatClip(fighter)).toBe('launch_hit');
    for (const [stateTicks, vy, y, frame] of [
      [0, 16, 0, 0],
      [4, 12, 60, 1],
      [12, 5, 140, 2],
      [18, 0, 170, 3],
      [25, -6, 110, 4],
      [35, -12, 15, 5],
    ]) {
      Object.assign(fighter, { stateTicks, vy, y });
      expect(combatFrame(fighter, 6, 48)).toBe(frame);
    }
    Object.assign(fighter, { state: 'knockdown', isAirJuggle: false, isGrounded: true, y: 0 });
    expect(combatClip(fighter)).toBe('fall');
    Object.assign(fighter, { state: 'jump_air', isGrounded: false });
    expect(combatClip(fighter)).toBe('idle');
  });
});

describe('combat atlas loading', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('ships a six-frame strip for every attack and defensive state in the roster', () => {
    for (const { definition } of Object.values(ROSTER)) {
      const folder = `public/game-assets/2d/fighter/combat-illustrated-v1/${definition.id}/`;
      const manifest = JSON.parse(readFileSync(`${folder}manifest.json`, 'utf8'));
      const fighter = new FighterSimulation(definition, definition).getState().p1;
      for (const move of Object.values(definition.moves)) {
        fighter.state = 'attack';
        fighter.currentMove = move;
        expect(manifest.clips[combatClip(fighter)]).toBeDefined();
      }
      for (const [name, clip] of Object.entries(manifest.clips) as [
        string,
        { file: string; frames: number; legacy?: boolean; powers?: boolean },
      ][]) {
        if (clip.legacy) continue;
        const base = clip.powers
          ? `public/game-assets/2d/fighter/combat-powers-v2/${definition.id}/`
          : folder;
        const png = readFileSync(`${base}${clip.file}`);
        expect(png.readUInt32BE(16), `${definition.id}/${name}`).toBe(manifest.size * 6);
        expect(png.readUInt32BE(20)).toBe(manifest.size);
        expect(clip.frames).toBe(6);
      }
      for (const name of ['block', 'block_low', 'hit_head', 'hit_body', 'launch_hit'])
        expect(manifest.clips[name]).toBeDefined();
    }
  });

  it('caches retained fighters and releases images and pending requests on replacement', async () => {
    const images: { src: string; removeAttribute: ReturnType<typeof vi.fn> }[] = [];
    vi.stubGlobal(
      'Image',
      class {
        src = '';
        removeAttribute = vi.fn();
        constructor() {
          images.push(this);
        }
      },
    );
    const manifest = JSON.parse(
      readFileSync('public/game-assets/2d/fighter/combat-illustrated-v1/amper/manifest.json', 'utf8'),
    );
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => manifest });
    vi.stubGlobal('fetch', fetchMock);
    const bank = new CombatSpriteBank();
    bank.retain(['amper']);
    await vi.waitFor(() => expect(images).toHaveLength(24));
    bank.retain(['amper']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(images.some((image) => image.src.endsWith('/art-v3/locomotion/amper/walk.png'))).toBe(true);
    expect(images.some((image) => image.src.endsWith('/combat-powers-v2/amper/uppercut_power.png'))).toBe(
      true,
    );
    bank.retain([]);
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    expect(images.every((image) => image.removeAttribute.mock.calls[0][0] === 'src')).toBe(true);
  });

  it('uses the baked atlas when the illustrated manifest is unavailable', async () => {
    const manifest = JSON.parse(
      readFileSync('public/game-assets/2d/fighter/combat/amper/manifest.json', 'utf8'),
    );
    vi.stubGlobal(
      'Image',
      class {
        src = '';
      },
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: true, json: async () => manifest });
    vi.stubGlobal('fetch', fetchMock);
    new CombatSpriteBank().retain(['amper']);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1][0]).toContain('/combat/amper/manifest.json');
  });
});
