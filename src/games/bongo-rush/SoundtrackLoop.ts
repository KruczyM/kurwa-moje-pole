/** Blend the opening into the tail once, then skip that opening at each loop boundary.
 * Complementary cosine envelopes avoid both a hard cut and boosting correlated notes.
 * The decoded buffer is owned by the audio host; no extra retained PCM buffer is needed.
 */
export function prepareSoundtrackLoop(buffer: AudioBuffer): number {
  const frames = Math.min(Math.round(buffer.sampleRate * 0.8), Math.floor(buffer.length / 4));
  if (frames < 2) return 0;
  const tail = buffer.length - frames;
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const samples = buffer.getChannelData(channel);
    for (let i = 0; i < frames; i++) {
      const incoming = (1 - Math.cos((Math.PI * i) / (frames - 1))) / 2;
      samples[tail + i] = samples[tail + i] * (1 - incoming) + samples[i] * incoming;
    }
  }
  return frames / buffer.sampleRate;
}

/** Preserve the initial intro, then advance through the shorter overlapping loop. */
export function soundtrackLoopPosition(position: number, duration: number, loopStart: number): number {
  return position < duration ? position : loopStart + ((position - duration) % (duration - loopStart));
}
