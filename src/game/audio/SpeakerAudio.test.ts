import { afterEach, describe, expect, it, vi } from 'vitest';
import { SpeakerAudio } from './SpeakerAudio';

class FakeAudio {
  loop = false;
  preload = '';
  volume = 1;
  playbackRate = 1;
  src: string;

  constructor(src: string) {
    this.src = src;
  }

  play() {
    return Promise.resolve();
  }

  pause() {}
}

describe('SpeakerAudio effect state', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('restores the exact volume and playback rate captured before an effect', () => {
    vi.stubGlobal('Audio', FakeAudio);
    const speaker = new SpeakerAudio('/music.mp3');
    const baseline = speaker.captureEffectState();

    speaker.applyEffectState({ volume: 0.2, playbackRate: 1.2 });
    expect(speaker.captureEffectState()).toEqual({ volume: 0.2, playbackRate: 1.2 });

    speaker.restoreEffectState(baseline);
    expect(speaker.captureEffectState()).toEqual(baseline);
    speaker.dispose();
  });
});
