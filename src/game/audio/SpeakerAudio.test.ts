import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SPEAKER_FADE_DURATION,
  DEFAULT_SPEAKER_INNER_RADIUS,
  DEFAULT_SPEAKER_OUTER_RADIUS,
  SpeakerAudio,
} from './SpeakerAudio';

class FakeAudio {
  loop = false;
  preload = '';
  volume = 0;
  playbackRate = 1;
  src: string;
  playCalls = 0;
  pauseCalls = 0;
  shouldRejectPlay = false;

  constructor(src: string) {
    this.src = src;
  }

  play() {
    this.playCalls++;
    if (this.shouldRejectPlay) {
      return Promise.reject(new Error('NotAllowedError: play failed'));
    }
    return Promise.resolve();
  }

  pause() {
    this.pauseCalls++;
  }
}

describe('SpeakerAudio spatial attenuation & playback lifecycle', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('restores the exact volume and playback rate captured before an effect', () => {
    const fake = new FakeAudio('/music.mp4');
    const speaker = new SpeakerAudio('/music.mp4', { factory: () => fake });
    speaker.setUserVolume(0.8);
    const baseline = speaker.captureEffectState();

    speaker.applyEffectState({ volume: 0.2, playbackRate: 1.2 });
    expect(speaker.captureEffectState()).toEqual({ volume: 0.2, playbackRate: 1.2 });

    speaker.restoreEffectState(baseline);
    expect(speaker.captureEffectState()).toEqual(baseline);
    speaker.dispose();
  });

  it('uses default spatial radii and fade duration when not specified', () => {
    const fake = new FakeAudio('/music.mp4');
    const speaker = new SpeakerAudio('/music.mp4', { factory: () => fake });
    speaker.setSpeakerPosition({ x: 0, y: 0, z: 0 });

    expect(speaker.calculateDistanceAttenuation({ x: DEFAULT_SPEAKER_INNER_RADIUS, y: 0, z: 0 })).toBe(1.0);
    expect(speaker.calculateDistanceAttenuation({ x: DEFAULT_SPEAKER_OUTER_RADIUS, y: 0, z: 0 })).toBe(0.0);
    expect(DEFAULT_SPEAKER_FADE_DURATION).toBeGreaterThan(0);
    speaker.dispose();
  });

  it('attenuates volume with distance from speaker position', () => {
    const fake = new FakeAudio('/music.mp4');
    const speaker = new SpeakerAudio('/music.mp4', {
      factory: () => fake,
      innerRadius: 4,
      outerRadius: 20,
      defaultUserVolume: 0.8,
    });
    speaker.setSpeakerPosition({ x: 0, y: 0, z: 0 });

    // Distance 0..4 (inside innerRadius) -> 100%
    expect(speaker.calculateDistanceAttenuation({ x: 0, y: 0, z: 0 })).toBe(1.0);
    expect(speaker.calculateDistanceAttenuation({ x: 3, y: 0, z: 0 })).toBe(1.0);
    expect(speaker.calculateDistanceAttenuation({ x: 4, y: 0, z: 0 })).toBe(1.0);

    // Distance >= 20 (outside outerRadius) -> 0%
    expect(speaker.calculateDistanceAttenuation({ x: 20, y: 0, z: 0 })).toBe(0.0);
    expect(speaker.calculateDistanceAttenuation({ x: 50, y: 0, z: 0 })).toBe(0.0);

    // Halfway: distance 12 (midway between 4 and 20) -> ratio = 0.5, quadratic = 0.25
    const midway = speaker.calculateDistanceAttenuation({ x: 12, y: 0, z: 0 });
    expect(midway).toBeCloseTo(0.25, 3);

    speaker.dispose();
  });

  it('performs smooth fade-in and fade-out over time', async () => {
    const fake = new FakeAudio('/music.mp4');
    const fadeDuration = 0.4;
    const speaker = new SpeakerAudio('/music.mp4', {
      factory: () => fake,
      fadeDuration,
      defaultUserVolume: 1.0,
      innerRadius: 10,
    });
    speaker.setSpeakerPosition({ x: 0, y: 0, z: 0 });

    // Initial state
    expect(speaker.playbackState).toBe('off');
    expect(fake.volume).toBe(0);

    // Start playing
    const playPromise = speaker.play();
    expect(speaker.playbackState).toBe('fading-in');
    await playPromise;

    // Simulate 50% of fade-in time
    speaker.update({ x: 0, y: 0, z: 0 }, fadeDuration * 0.5);
    expect(speaker.playbackState).toBe('fading-in');
    expect(fake.volume).toBeCloseTo(0.5, 2);

    // Complete fade-in
    speaker.update({ x: 0, y: 0, z: 0 }, fadeDuration * 0.5);
    expect(speaker.playbackState).toBe('on');
    expect(fake.volume).toBeCloseTo(1.0, 2);

    // Stop (triggers fade-out)
    speaker.stop();
    expect(speaker.playbackState).toBe('fading-out');

    // Midway fade-out
    speaker.update({ x: 0, y: 0, z: 0 }, fadeDuration * 0.5);
    expect(speaker.playbackState).toBe('fading-out');
    expect(fake.volume).toBeCloseTo(0.5, 2);

    // Finish fade-out
    speaker.update({ x: 0, y: 0, z: 0 }, fadeDuration * 0.5);
    expect(speaker.playbackState).toBe('off');
    expect(fake.volume).toBe(0);
    expect(fake.pauseCalls).toBeGreaterThanOrEqual(1);

    speaker.dispose();
  });

  it('handles toggle switching between on and off', async () => {
    const fake = new FakeAudio('/music.mp4');
    const speaker = new SpeakerAudio('/music.mp4', { factory: () => fake, fadeDuration: 0.1 });

    const turningOn = await speaker.toggle();
    expect(turningOn).toBe(true);
    expect(speaker.isPlaying).toBe(true);

    const turningOff = await speaker.toggle();
    expect(turningOff).toBe(false);
    expect(speaker.playbackState).toBe('fading-out');

    speaker.dispose();
  });

  it('recovers gracefully from autoplay rejection without throwing unhandled rejection', async () => {
    const fake = new FakeAudio('/music.mp4');
    fake.shouldRejectPlay = true;
    const speaker = new SpeakerAudio('/music.mp4', { factory: () => fake });

    const started = await speaker.play();
    expect(started).toBe(false);

    speaker.dispose();
  });

  it('stopImmediate stops and zeroes volume immediately', async () => {
    const fake = new FakeAudio('/music.mp4');
    const speaker = new SpeakerAudio('/music.mp4', { factory: () => fake });
    await speaker.play();
    speaker.update({ x: 0, y: 0, z: 0 }, 1.0);

    speaker.stopImmediate();
    expect(speaker.playbackState).toBe('off');
    expect(fake.volume).toBe(0);
    expect(fake.pauseCalls).toBeGreaterThanOrEqual(1);

    speaker.dispose();
  });
});
