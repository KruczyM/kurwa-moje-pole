import { describe, expect, it, vi } from 'vitest';
import { AnimationLoop } from './AnimationLoop';

describe('AnimationLoop', () => {
  it('starts once and cancels its only scheduled frame', () => {
    const callbacks: FrameRequestCallback[] = [],
      schedule = vi.fn((callback: FrameRequestCallback) => {
        callbacks.push(callback);
        return callbacks.length;
      });
    const cancel = vi.fn(),
      update = vi.fn(),
      loop = new AnimationLoop(update, schedule, cancel);
    expect(loop.start()).toBe(true);
    expect(loop.start()).toBe(false);
    expect(schedule).toHaveBeenCalledTimes(1);
    callbacks[0](10);
    expect(update).toHaveBeenCalledOnce();
    expect(schedule).toHaveBeenCalledTimes(2);
    expect(loop.stop()).toBe(true);
    expect(loop.stop()).toBe(false);
    expect(cancel).toHaveBeenCalledOnce();
    callbacks[1](20);
    expect(update).toHaveBeenCalledOnce();
  });
});
