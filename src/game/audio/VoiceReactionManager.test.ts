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

  it('plays festival camp shouts and triggers registered callback', () => {
    const manager = new VoiceReactionManager();
    const shouts: string[] = [];
    manager.setCampShoutCallback((event) => {
      shouts.push(event.text);
    });

    const shout1 = manager.playCampShout(0);
    expect(shout1.text).toBe('Zaraz będzie ciemno!');
    expect(shout1.response).toBe('ZAMKNIJ SIĘ!');
    expect(shouts).toContain('Zaraz będzie ciemno!');

    const shout2 = manager.playCampShout(1);
    expect(shout2.text).toBe('Pooole! Kurwa, moje pole!');

    const shout3 = manager.playCampShout(2);
    expect(shout3.text).toBe('Siemankooo!');
  });

  it('triggers camp shouts periodically during update', () => {
    const manager = new VoiceReactionManager(() => 0.5);
    const triggered: string[] = [];
    manager.setCampShoutCallback((event) => {
      triggered.push(event.text);
    });

    // Advance by 120 seconds to trigger periodic camp shout
    manager.update(120, null, 'inactive');
    expect(triggered.length).toBeGreaterThanOrEqual(1);
    manager.dispose();
  });

  it('safely handles non-substance items like Woda and Okulary in effectStarted', () => {
    const manager = new VoiceReactionManager();
    expect(() => manager.effectStarted('Woda')).not.toThrow();
    expect(() => manager.effectStarted('Okulary')).not.toThrow();
    manager.dispose();
  });
});
