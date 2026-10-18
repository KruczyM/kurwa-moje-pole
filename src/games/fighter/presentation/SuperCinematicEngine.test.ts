import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SuperCinematicEngine } from './SuperCinematicEngine';
import { SuperPropsRenderer } from './SuperPropsRenderer';
import { FighterState, MatchState } from '../simulation/CombatTypes';
import { ROSTER } from '../data/fighters/roster';
import { combatMove } from '../simulation/combatTiming';

describe('SuperCinematicEngine (16 Festival Character Super Move Animations)', () => {
  let engine: SuperCinematicEngine;
  let mockAudio: any;
  let mockCamera: any;
  let mockMatch: MatchState;

  function createMockFighter(id: string, x = -100): FighterState {
    return {
      id,
      x,
      y: 0,
      vx: 0,
      vy: 0,
      facing: 1,
      state: 'idle',
      stateTicks: 0,
      hp: 1000,
      maxHp: 1000,
      meter: 100,
      currentMove: null,
      moveTick: 0,
      hitstop: 0,
      isGrounded: true,
      comboHits: 0,
      lastHitBy: null,
    };
  }

  beforeEach(() => {
    engine = new SuperCinematicEngine();
    mockAudio = {
      playSuperStartup: vi.fn(),
      playUltimateImpact: vi.fn(),
      playGlassShatter: vi.fn(),
      playPropellerSpin: vi.fn(),
      playLaserBeam: vi.fn(),
      playFlushToilet: vi.fn(),
      playDJScratch: vi.fn(),
      playEngineRoar: vi.fn(),
      playLighterFlicks: vi.fn(),
      playMegaphoneScreech: vi.fn(),
      playJBLBassDrop: vi.fn(),
      playWhispers: vi.fn(),
      playBonk: vi.fn(),
      playSlap: vi.fn(),
      playBoing: vi.fn(),
      playPop: vi.fn(),
      playKOGong: vi.fn(),
      playSlideWhistle: vi.fn(),
      playFart: vi.fn(),
    };
    mockCamera = {
      shake: vi.fn(),
    };
    mockMatch = {
      tick: 0,
      roundTimer: 90,
      roundNumber: 1,
      roundState: 'fight',
      winner: null,
      p1Wins: 0,
      p2Wins: 0,
      stateTicks: 0,
      p1: createMockFighter('amper', -150),
      p2: createMockFighter('korba', 150),
    };
  });

  it('starts inactive and activates on startCinematic()', () => {
    expect(engine.isCinematicActive()).toBe(false);

    const dummyImg = {} as HTMLImageElement;
    engine.startCinematic(
      mockMatch.p1,
      mockMatch.p2,
      'special',
      'Lusterko Eleganta',
      'Amper',
      dummyImg,
      '#0284c7',
      mockAudio,
    );

    expect(engine.isCinematicActive()).toBe(true);
    expect(mockAudio.playSuperStartup).toHaveBeenCalled();

    const state = engine.getActiveState();
    expect(state).not.toBeNull();
    expect(state?.attackerId).toBe('amper');
    expect(state?.phase).toBe('freeze');
  });

  it('progresses through freeze, action, impact and recovery phases', () => {
    const dummyImg = {} as HTMLImageElement;
    engine.startCinematic(
      mockMatch.p1,
      mockMatch.p2,
      'special',
      'Lusterko Eleganta',
      'Amper',
      dummyImg,
      '#0284c7',
      mockAudio,
    );

    const onImpact = vi.fn();

    // Advance 30 ticks (freeze phase)
    for (let i = 0; i < 30; i++) {
      engine.update(mockMatch, mockCamera, mockAudio, onImpact);
    }
    expect(engine.getActiveState()?.phase).toBe('freeze');

    // Advance to tick 60 (action phase)
    for (let i = 0; i < 30; i++) {
      engine.update(mockMatch, mockCamera, mockAudio, onImpact);
    }
    expect(engine.getActiveState()?.phase).toBe('action');

    // Advance to tick 80 (impact phase)
    for (let i = 0; i < 20; i++) {
      engine.update(mockMatch, mockCamera, mockAudio, onImpact);
    }
    expect(engine.getActiveState()?.phase).toBe('impact');
    expect(onImpact).toHaveBeenCalled();
    expect(mockMatch.p2.hp).toBe(1000); // Presentation must never apply combat damage.
    expect(mockCamera.shake).toHaveBeenCalled();
    expect(mockAudio.playUltimateImpact).toHaveBeenCalledWith('amper');

    // Advance to end of cinematic
    for (let i = 0; i < 30; i++) {
      engine.update(mockMatch, mockCamera, mockAudio, onImpact);
    }
    expect(engine.isCinematicActive()).toBe(false);
  });

  it('synchronizes each special and ultimate with startup, contact, hitstop and interruption', () => {
    for (const { definition } of Object.values(ROSTER)) {
      for (const moveId of ['special', 'ultimate']) {
        const attacker = createMockFighter(definition.id, -50);
        const defender = createMockFighter(definition.id, 50); // mirror match must retain side identity
        const move = combatMove(definition.moves[moveId]);
        Object.assign(attacker, { state: 'attack', currentMove: move });
        mockMatch.p1 = defender;
        mockMatch.p2 = attacker;
        const impact = vi.fn();
        engine.startCinematic(
          attacker,
          defender,
          moveId,
          move.name,
          definition.name,
          {} as HTMLImageElement,
          '#ffffff',
        );
        engine.update(mockMatch, mockCamera, mockAudio, impact);
        expect(engine.getActiveState()?.phase).toBe('freeze');
        attacker.moveTick = move.startup;
        engine.update(mockMatch, mockCamera, mockAudio, impact);
        expect(engine.getActiveState()?.phase).toBe('action');
        expect(impact).not.toHaveBeenCalled();
        attacker.moveTick++;
        engine.update(mockMatch, mockCamera, mockAudio, impact);
        expect(engine.getActiveState()?.phase).toBe('impact');
        expect(impact).not.toHaveBeenCalled(); // whiff: effects never confirm a hit
        attacker.hasHit = true;
        defender.state = 'block_high';
        engine.update(mockMatch, mockCamera, mockAudio, impact);
        expect(impact).not.toHaveBeenCalled();
        defender.state = 'hit_stun';
        engine.update(mockMatch, mockCamera, mockAudio, impact);
        expect(impact).toHaveBeenCalledTimes(1);
        expect(engine.getActiveState()?.attackerX).toBe(-50);
        expect(engine.getActiveState()?.defenderX).toBe(50);
        const tick = engine.getActiveState()?.currentTick;
        for (let freeze = 0; freeze < 12; freeze++) engine.update(mockMatch, mockCamera, mockAudio, impact);
        expect(engine.getActiveState()?.currentTick).toBe(tick);
        expect(impact).toHaveBeenCalledTimes(1);
        expect(defender.hp).toBe(1000);
        attacker.moveTick = move.startup + move.active + 1;
        engine.update(mockMatch, mockCamera, mockAudio, impact);
        expect(engine.getActiveState()?.phase).toBe('recovery');
        attacker.state = 'hit_stun';
        engine.update(mockMatch, mockCamera, mockAudio, impact);
        expect(engine.isCinematicActive()).toBe(false);
      }
    }
  });

  it('keeps the portrait on screen throughout the shared 800 ms freeze', () => {
    const attacker = mockMatch.p1;
    Object.assign(attacker, {
      state: 'attack',
      currentMove: combatMove(ROSTER.amper.definition.moves.ultimate),
    });
    engine.startCinematic(
      attacker,
      mockMatch.p2,
      'ultimate',
      'Zwierciadło Wąsa',
      'Amper',
      {} as HTMLImageElement,
      '#0284c7',
      mockAudio,
    );
    mockMatch.superFreezeTotal = 48;
    for (let remaining = 48; remaining > 0; remaining--) {
      mockMatch.superFreezeTicks = remaining;
      engine.update(mockMatch, mockCamera, mockAudio);
      expect(engine.getActiveState()?.phase).toBe('freeze');
      expect(mockAudio.playUltimateImpact).not.toHaveBeenCalled();
    }
    mockMatch.superFreezeTicks = 0;
    attacker.moveTick = 10;
    engine.update(mockMatch, mockCamera, mockAudio);
    expect(engine.getActiveState()?.phase).toBe('action');
  });

  it('runs smoothly for all 16 festival characters', () => {
    const all16Characters = [
      'amper',
      'korba',
      'klatwa',
      'chlebak',
      'kobra',
      'zawor',
      'szerszen',
      'dziaslo',
      'hemoroid',
      'jeczmien',
      'ambona',
      'antena',
      'gruczol',
      'krwiak',
      'pien',
      'pierscien',
    ];

    const dummyImg = {} as HTMLImageElement;

    for (const charId of all16Characters) {
      const p1 = createMockFighter(charId, -120);
      const p2 = createMockFighter('korba', 120);
      mockMatch.p1 = p1;
      mockMatch.p2 = p2;

      engine.startCinematic(p1, p2, 'special', 'Super Move', charId, dummyImg, '#ffffff', mockAudio);
      expect(engine.isCinematicActive()).toBe(true);

      // Advance through full cinematic
      for (let i = 0; i < 110; i++) {
        engine.update(mockMatch, mockCamera, mockAudio);
      }
      expect(engine.isCinematicActive()).toBe(false);
    }
  });

  it('draws cached AI props and releases discarded fighters', () => {
    const images: { src: string; removeAttribute: ReturnType<typeof vi.fn> }[] = [];
    vi.stubGlobal(
      'Image',
      class {
        src = '';
        complete = true;
        naturalWidth = 640;
        naturalHeight = 640;
        removeAttribute = vi.fn();
        constructor() {
          images.push(this);
        }
      },
    );
    try {
      const renderer = new SuperPropsRenderer();
      const ctx = {
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        rotate: vi.fn(),
        scale: vi.fn(),
        drawImage: vi.fn(),
      } as unknown as CanvasRenderingContext2D;
      renderer.retain(['gruczol', 'szerszen']);
      for (const id of ['gruczol', 'szerszen', 'paper']) renderer.drawProp(ctx, id, 0, 0, 100, 100);
      expect(ctx.drawImage).toHaveBeenCalledTimes(3);
      const old = [...images];
      renderer.retain(['amper', 'korba']);
      expect(old.every((image) => image.removeAttribute.mock.calls.length === 1)).toBe(true);
      renderer.drawProp(ctx, 'amper', 0, 0, 100, 100);
      expect(ctx.drawImage).toHaveBeenCalledTimes(4);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
