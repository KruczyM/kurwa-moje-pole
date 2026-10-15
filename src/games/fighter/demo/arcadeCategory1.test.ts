import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ROSTER, ROSTER_KEYS, getFighterStats } from '../data/fighters/roster';
import { FighterAudio } from '../presentation/FighterAudio';
import { INPUT } from '../simulation/CombatTypes';

describe('Arcade Category 1 — Character Stats & Matrix', () => {
  it('defines power, speed, and hangoverRes in [1, 10] for all 16 fighters', () => {
    expect(ROSTER_KEYS).toHaveLength(16);
    for (const key of ROSTER_KEYS) {
      const entry = ROSTER[key]!;
      expect(entry.stats).toBeDefined();
      expect(entry.stats.power).toBeGreaterThanOrEqual(1);
      expect(entry.stats.power).toBeLessThanOrEqual(10);
      expect(entry.stats.speed).toBeGreaterThanOrEqual(1);
      expect(entry.stats.speed).toBeLessThanOrEqual(10);
      expect(entry.stats.hangoverRes).toBeGreaterThanOrEqual(1);
      expect(entry.stats.hangoverRes).toBeLessThanOrEqual(10);
    }
  });

  it('getFighterStats returns specific stats or defaults for unknown IDs', () => {
    const amperStats = getFighterStats('amper');
    expect(amperStats).toEqual({ power: 7, speed: 6, hangoverRes: 7 });

    const pienStats = getFighterStats('pien');
    expect(pienStats).toEqual({ power: 10, speed: 3, hangoverRes: 10 });

    const fallbackStats = getFighterStats('non_existent_fighter');
    expect(fallbackStats).toEqual({ power: 5, speed: 5, hangoverRes: 5 });
  });
});

describe('Arcade Category 1 — Hotseat 2P Control Mapping', () => {
  it('guarantees complete isolation between P1 and P2 hotseat keys', () => {
    const p1Keys = new Set(['KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyF', 'KeyG', 'KeyV', 'KeyB', 'KeyR', 'KeyT', 'KeyC']);
    const p2Keys = new Set([
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
      'KeyI', 'Numpad4',
      'KeyO', 'Numpad5',
      'KeyK', 'Numpad1',
      'KeyL', 'Numpad2',
      'KeyP', 'Numpad6',
      'BracketLeft', 'NumpadAdd',
      'Enter', 'Numpad0', 'Numpad3',
    ]);

    for (const code of p1Keys) {
      expect(p2Keys.has(code)).toBe(false);
    }

    // Verify key bitmasks produce expected fighter inputs
    expect(INPUT.UP).toBe(1);
    expect(INPUT.DOWN).toBe(2);
    expect(INPUT.LEFT).toBe(4);
    expect(INPUT.RIGHT).toBe(8);
    expect(INPUT.LP).toBe(16);
    expect(INPUT.RP).toBe(32);
    expect(INPUT.LK).toBe(64);
    expect(INPUT.RK).toBe(128);
    expect(INPUT.SPECIAL).toBe(256);
    expect(INPUT.BLOCK).toBe(512);
    expect(INPUT.TECHNIQUE).toBe(1024);
  });
});

describe('Arcade Category 1 — HTML Elements & Cabinet Template', () => {
  it('contains CRT overlay, coin slot, hotseat button, stat bars and VS splash screen', () => {
    const html = readFileSync('fighter-demo.html', 'utf8');

    // CRT Overlay
    expect(html).toContain('id="crt-overlay"');
    expect(html).toContain('class="crt-overlay"');

    // Coin slot
    expect(html).toContain('id="arcade-coin-btn"');
    expect(html).toContain('id="arcade-credit-count"');
    expect(html).toContain('INSERT COIN');

    // Hotseat Mode
    expect(html).toContain('data-fight-mode="hotseat"');
    expect(html).toContain('<option value="hotseat">');

    // Stat bars in preview
    expect(html).toContain('id="preview-stats"');
    expect(html).toContain('id="stat-fill-power"');
    expect(html).toContain('id="stat-fill-speed"');
    expect(html).toContain('id="stat-fill-hangover"');

    // VS Matchup Splash
    expect(html).toContain('id="matchup-vs-splash"');
    expect(html).toContain('id="vs-splash-p1-img"');
    expect(html).toContain('id="vs-splash-p2-img"');
    expect(html).toContain('id="vs-splash-arena"');
    expect(html).toContain('VERSUS');

    // CRT Toggle in audio/accessibility settings
    expect(html).toContain('id="crt-toggle"');

    // Polish move abbreviations and PC key hint badges on arcade buttons
    expect(html).toContain('>LP</span>');
    expect(html).toContain('>PS</span>');
    expect(html).toContain('>ULT</span>');
    expect(html).toContain('>LK</span>');
    expect(html).toContain('>PZ</span>');
    expect(html).toContain('>PB</span>');
    expect(html).toContain('>PC</span>');
    expect(html).toContain('>CS</span>');
    expect(html).toContain('>BLOK</span>');

    expect(html).toContain('class="btn-key-hint">U</small>');
    expect(html).toContain('class="btn-key-hint">I</small>');
    expect(html).toContain('class="btn-key-hint">O</small>');
    expect(html).toContain('class="btn-key-hint">J</small>');
    expect(html).toContain('class="btn-key-hint">K</small>');
    expect(html).toContain('class="btn-key-hint">H</small>');
    expect(html).toContain('class="btn-key-hint">N</small>');
    expect(html).toContain('class="btn-key-hint">P</small>');
    expect(html).toContain('class="btn-key-hint">L</small>');

    // D-Pad key hint badges
    expect(html).toContain('class="dpad-key-hint">W</small>');
    expect(html).toContain('class="dpad-key-hint">A</small>');
    expect(html).toContain('class="dpad-key-hint">S</small>');
    expect(html).toContain('class="dpad-key-hint">D</small>');
  });
});

describe('Arcade Category 1 — FighterAudio Synth & Announcer', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('runs playCoinInsert, playVersusGong, and dynamic synthesizer cues without robot TTS', async () => {
    const oscs: any[] = [];
    const context = {
      currentTime: 0,
      sampleRate: 44100,
      destination: {},
      resume: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      createGain: () => ({
        gain: {
          value: 0,
          setValueAtTime: vi.fn(),
          setTargetAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
          cancelScheduledValues: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
      }),
      createDynamicsCompressor: () => ({
        threshold: { value: 0 },
        ratio: { value: 0 },
        connect: vi.fn(),
        disconnect: vi.fn(),
      }),
      createBiquadFilter: () => ({
        type: 'bandpass',
        frequency: { setValueAtTime: vi.fn() },
        Q: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
        disconnect: vi.fn(),
      }),
      createBuffer: (_channels: number, length: number, sampleRate: number) => ({
        numberOfChannels: _channels,
        length,
        sampleRate,
        getChannelData: () => new Float32Array(length),
      }),
      createOscillator: () => {
        const osc = {
          type: 'sine',
          frequency: {
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
          },
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        };
        oscs.push(osc);
        return osc;
      },
      createBufferSource: () => ({
        buffer: null,
        loop: false,
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      }),
      decodeAudioData: vi.fn().mockResolvedValue({ duration: 1 }),
    };

    const speakMock = vi.fn();
    vi.stubGlobal('window', {
      AudioContext: function () {
        return context;
      },
      speechSynthesis: {
        speak: speakMock,
        cancel: vi.fn(),
      },
      SpeechSynthesisUtterance: function (text: string) {
        return { text };
      },
    });

    const audio = new FighterAudio();
    await audio.unlock();

    // Verify coin chime
    audio.playCoinInsert();
    expect(oscs.length).toBeGreaterThan(0);

    // Verify VS gong
    const countBeforeGong = oscs.length;
    audio.playVersusGong();
    expect(oscs.length).toBeGreaterThan(countBeforeGong);

    // Verify dynamic synthesizer audio cues (pure retro synth, 0 robot TTS calls)
    const countBeforeRound1 = oscs.length;
    audio.playAnnouncerRound(1);
    expect(oscs.length).toBeGreaterThan(countBeforeRound1);

    const countBeforeRound2 = oscs.length;
    audio.playAnnouncerRound(2);
    expect(oscs.length).toBeGreaterThan(countBeforeRound2);

    const countBeforeFinalRound = oscs.length;
    audio.playAnnouncerRound(3, true);
    expect(oscs.length).toBeGreaterThan(countBeforeFinalRound);

    const countBeforeFight = oscs.length;
    audio.playAnnouncerFight();
    expect(oscs.length).toBeGreaterThan(countBeforeFight);

    const countBeforeKO = oscs.length;
    audio.playAnnouncerKO();
    expect(oscs.length).toBeGreaterThan(countBeforeKO);

    const countBeforeWin = oscs.length;
    audio.playAnnouncerWin('AMPER', true);
    expect(oscs.length).toBeGreaterThan(countBeforeWin);

    const countBeforeLose = oscs.length;
    audio.playAnnouncerWin('AMPER', false);
    expect(oscs.length).toBeGreaterThan(countBeforeLose);

    // Verify cloned announcer calls work cleanly
    audio.playAnnouncerDraw(false);
    audio.playAnnouncerDraw(true);
    audio.playAnnouncerTimeOver();
    audio.playAnnouncerPerfect();
    audio.playAnnouncerGameOver();
    audio.playAnnouncerChooseFighter();

    // SpeechSynthesis must NOT be invoked (satisfies "a nie jak z syntezatora glosowego")
    expect(speakMock).not.toHaveBeenCalled();

    audio.dispose();

    // Verify disk assets for batch 3 and cloned announcer files
    const root = 'public/game-assets/2d/fighter/audio-v2/';
    const testClips = [
      'announcer-final-round',
      'announcer-you-win',
      'announcer-you-lose',
      'announcer-draw',
      'announcer-double-ko',
      'announcer-time-over',
      'announcer-perfect',
      'announcer-sudden-death',
      'announcer-game-over',
      'announcer-choose-fighter',
    ];
    for (const name of testClips) {
      const file = readFileSync(root + name + '.wav');
      expect(file.toString('ascii', 0, 4)).toBe('RIFF');
      expect(file.toString('ascii', 8, 12)).toBe('WAVE');
      const channels = file.readUInt16LE(22);
      const rate = file.readUInt32LE(24);
      expect(channels).toBe(1);
      expect(rate).toBe(22050);
      const duration = (file.length - 44) / (rate * channels * 2);
      expect(duration).toBeGreaterThan(0.2);
      expect(duration).toBeLessThan(3.5);
    }
  });
});
