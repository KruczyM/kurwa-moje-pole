import { describe, expect, it } from 'vitest';
import { EffectTimeline } from './EffectTimeline';

const durations = { fadeIn: 2, active: 4, fadeOut: 2 };

describe('EffectTimeline', () => {
  it('reports the current phase time and completes all three phases', () => {
    const timeline = new EffectTimeline();
    timeline.use('Joint', durations);
    timeline.update(1, durations);
    expect(timeline.phase).toBe('fadeIn');
    expect(timeline.intensity).toBe(0.5);
    expect(timeline.remaining).toBe(1);

    timeline.update(1, durations);
    expect(timeline.phase).toBe('active');
    expect(timeline.remaining).toBe(4);
    timeline.update(4, durations);
    expect(timeline.phase).toBe('fadeOut');
    expect(timeline.remaining).toBe(2);
    expect(timeline.update(2, durations)).toBe(true);
    expect(timeline.phase).toBe('inactive');
    expect(timeline.active).toBeNull();
  });

  it('cancels smoothly from the current fade-in intensity', () => {
    const timeline = new EffectTimeline();
    timeline.use('MDMA', durations);
    timeline.update(0.5, durations);
    timeline.cancel(durations);
    expect(timeline.phase).toBe('fadeOut');
    expect(timeline.intensity).toBe(0.25);
    expect(timeline.remaining).toBe(0.5);
    expect(timeline.update(0.5, durations)).toBe(true);
  });

  it('restarts safely when effects are switched rapidly', () => {
    const timeline = new EffectTimeline();
    timeline.use('LSD', durations);
    timeline.update(1, durations);
    timeline.use('Grzyb', durations);
    expect(timeline.active).toBe('Grzyb');
    expect(timeline.phase).toBe('fadeIn');
    expect(timeline.intensity).toBe(0);
    expect(timeline.remaining).toBe(2);
  });
});
