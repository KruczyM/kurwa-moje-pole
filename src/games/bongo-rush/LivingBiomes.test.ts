import { describe, it, expect } from 'vitest';
import { MenuFlow } from './MenuFlow';
import { HEROES } from './Progress';
import { soilHoles, terrainEdges } from './TerrainDetails';
import { VisualEffects } from './VisualEffects';
import { musicPhrase, musicCycleBeats, MUSIC_BPM, BIOME_MELODIES } from './Music';
import { sceneParticle } from './LivingScene';

describe('explicit cosmetic menu navigation', () => {
  it('never starts or confirms a saved hero from the title', () => {
    const flow = new MenuFlow('pierscien');
    expect(flow.hero).toBe('pierscien');
    flow.confirm();
    expect(flow.canStart(0, 1)).toBe(false);
    flow.openHeroes();
    expect(flow.choose('kobra')).toBe(false);
    expect(flow.canStart(0, 1)).toBe(false);
    flow.confirm();
    expect(flow.screen).toBe('title');
    expect(flow.canStart(0, 1)).toBe(false);
    flow.openLevels();
    expect(flow.canStart(0, 1)).toBe(true);
    for (const index of [-1, 1, 0.5, NaN]) expect(flow.canStart(index, 1)).toBe(false);
    flow.back();
    expect(flow.screen).toBe('heroes');
    expect(flow.confirmed).toBe(false);
    flow.back();
    expect(flow.screen).toBe('title');
  });
  it('supports every playable character without changing mechanics', () => {
    const flow = new MenuFlow('invalid');
    for (const hero of HEROES) {
      flow.openHeroes();
      expect(flow.choose(hero)).toBe(true);
      flow.confirm();
      expect(flow.hero).toBe(hero);
      expect(flow.screen).toBe('title');
      expect(flow.canStart(15, 16)).toBe(false);
      flow.openLevels();
      expect(flow.canStart(15, 16)).toBe(true);
      flow.title();
      expect(flow.canStart(15, 16)).toBe(false);
    }
  });
});

describe('readable terrain and bounded decoration', () => {
  it.each([0, 1, 2, 3])('removes 5–15 percent of soil pixels in biome %i, not its boundary', (biome) => {
    for (const variant of [0, 1]) {
      const pixels = new Set<number>();
      for (const hole of soilHoles(biome, variant)) {
        expect(hole.x).toBeGreaterThan(0);
        expect(hole.y).toBeGreaterThan(0);
        expect(hole.x + hole.width).toBeLessThan(64);
        expect(hole.y + hole.height).toBeLessThan(64);
        for (let y = hole.y; y < hole.y + hole.height; y++)
          for (let x = hole.x; x < hole.x + hole.width; x++) pixels.add(y * 64 + x);
      }
      expect(pixels.size / 4096).toBeGreaterThanOrEqual(0.05);
      expect(pixels.size / 4096).toBeLessThanOrEqual(0.15);
    }
  });
  it('detects exposed sides without mistaking rooted soil for a walkable tunnel', () => {
    expect(
      terrainEdges(
        {
          width: 3,
          height: 3,
          cells: ['wall', 'air', 'wall', 'buried-bush', 'soil', 'exit', 'wall', 'air', 'wall'],
        },
        1,
        1,
      ),
    ).toBe(7);
    expect(terrainEdges({ width: 1, height: 1, cells: ['soil'] }, 0, 0)).toBe(0);
  });
  it('freezes paused dust, bounds cave-in debris and clears reduced-motion runs', () => {
    const fx = new VisualEffects();
    for (let i = 0; i < 100; i++) fx.emit({ x: 3, y: 4 }, 8);
    expect(fx.chips).toHaveLength(32);
    const before = structuredClone(fx.chips);
    fx.update(0.2, true, false);
    expect(fx.chips).toEqual(before);
    fx.update(0.5, false, false);
    expect(fx.chips).toHaveLength(0);
    fx.emit({ x: 0, y: 0 }, 6);
    fx.update(0.01, true, true);
    expect(fx.chips).toHaveLength(0);
  });
  it('keeps ambient particles deterministic and inside the viewport', () => {
    for (let i = 0; i < 24; i++) {
      const p = sceneParticle(i, 125.2, true);
      expect(p).toEqual(sceneParticle(i, 125.2, true));
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThan(1);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThan(1);
    }
  });
});

describe('memorable two-minute compositions', () => {
  it.each([0, 1, 2, 3])('has a distinct theme, rests and a quieter menu in biome %i', (biome) => {
    expect((musicCycleBeats(biome) * 60) / MUSIC_BPM[biome]).toBe(120);
    expect(new Set(BIOME_MELODIES.map((melody) => melody.join(','))).size).toBe(4);
    let full = 0,
      menu = 0,
      rests = 0;
    for (let beat = 0; beat < musicCycleBeats(biome); beat++) {
      full += musicPhrase(biome, beat).length;
      menu += musicPhrase(biome, beat, true).length;
      if (!musicPhrase(biome, beat).length) rests++;
    }
    expect(menu).toBeLessThan(full);
    expect(rests).toBeGreaterThan(10);
    expect(musicPhrase(biome, 0)).toEqual(musicPhrase(biome, musicCycleBeats(biome)));
  });
});
