import { describe, expect, it, vi } from 'vitest';
import { VoiceReactionManager, allVoiceReactionNames, supportedVoiceEffects } from './VoiceReactionManager';

type FakeAudio = {
  src: string;
  volume: number;
  currentTime: number;
  play: () => Promise<void>;
  pause: () => void;
};
const fakeAudio = (): FakeAudio => ({
  src: '',
  volume: 0,
  currentTime: 0,
  play: vi.fn(async () => undefined),
  pause: vi.fn(),
});

describe('VoiceReactionManager', () => {
  it('covers every gameplay effect and keeps catalog entries unique', () => {
    expect(supportedVoiceEffects).toEqual(['Piwo', 'Papieros', 'Joint', 'Kreska', 'Grzyb', 'MDMA', 'LSD']);
    const names = allVoiceReactionNames();
    expect(names.length).toBeGreaterThan(90);
    expect(new Set(names).size).toBe(names.length);
  });

  it('chooses one sound from a pool and avoids immediate repetition', () => {
    const channels = [fakeAudio(), fakeAudio()],
      manager = new VoiceReactionManager(
        () => 0,
        () => channels.shift()!,
      );
    expect(manager.playGameEntry()).toBe('dude_todaysthefirst');
    expect(manager.playGameEntry()).toBe('dude_uncledaveparty');
  });

  it('evaluates the ten-percent trip reaction only once per effect', () => {
    const foreground = fakeAudio(),
      distant = fakeAudio(),
      values = [0.05, 0, 0];
    const manager = new VoiceReactionManager(
      () => values.shift() ?? 0.5,
      (() => {
        const channels = [foreground, distant];
        return () => channels.shift()!;
      })(),
    );
    manager.update(1, 'LSD', 'active');
    manager.update(1, 'LSD', 'active');
    expect(foreground.play).toHaveBeenCalledTimes(1);
  });

  it('prepares overdose audio after four uses in one minute', () => {
    const foreground = fakeAudio(),
      distant = fakeAudio();
    const manager = new VoiceReactionManager(
      () => 0,
      (() => {
        const channels = [foreground, distant];
        return () => channels.shift()!;
      })(),
    );
    manager.effectStarted('Joint', 1_000);
    manager.effectStarted('MDMA', 2_000);
    manager.effectStarted('LSD', 3_000);
    manager.effectStarted('Kreska', 4_000);
    expect(distant.src).toContain('dude_buttsauce.wav');
    expect(distant.volume).toBe(0.24);
  });
});
