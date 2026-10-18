import { describe, expect, it } from 'vitest';
import { RateLimiter } from './RateLimiter';

describe('RateLimiter', () => {
  it('allows requests within capacity', () => {
    const limiter = new RateLimiter({
      action: { capacity: 3, refillRatePerSec: 1 },
    });

    const now = 10000;
    expect(limiter.consume('client-1', 'action', 1, now)).toBe(true);
    expect(limiter.consume('client-1', 'action', 1, now)).toBe(true);
    expect(limiter.consume('client-1', 'action', 1, now)).toBe(true);
    // 4th request exceeds capacity
    expect(limiter.consume('client-1', 'action', 1, now)).toBe(false);
  });

  it('refills tokens over time', () => {
    const limiter = new RateLimiter({
      action: { capacity: 2, refillRatePerSec: 2 },
    });

    let now = 1000;
    expect(limiter.consume('c1', 'action', 1, now)).toBe(true);
    expect(limiter.consume('c1', 'action', 1, now)).toBe(true);
    expect(limiter.consume('c1', 'action', 1, now)).toBe(false);

    // After 1 second, 2 tokens should have refilled
    now += 1000;
    expect(limiter.consume('c1', 'action', 1, now)).toBe(true);
    expect(limiter.consume('c1', 'action', 1, now)).toBe(true);
    expect(limiter.consume('c1', 'action', 1, now)).toBe(false);
  });

  it('isolates different clients and categories', () => {
    const limiter = new RateLimiter({
      action: { capacity: 1, refillRatePerSec: 1 },
      movement: { capacity: 5, refillRatePerSec: 5 },
    });

    const now = 5000;
    expect(limiter.consume('c1', 'action', 1, now)).toBe(true);
    expect(limiter.consume('c1', 'action', 1, now)).toBe(false);

    // c2 still has tokens
    expect(limiter.consume('c2', 'action', 1, now)).toBe(true);

    // c1 still has movement tokens
    expect(limiter.consume('c1', 'movement', 1, now)).toBe(true);
  });

  it('removes client on disconnect', () => {
    const limiter = new RateLimiter({
      action: { capacity: 1, refillRatePerSec: 1 },
    });

    const now = 5000;
    expect(limiter.consume('c1', 'action', 1, now)).toBe(true);
    expect(limiter.consume('c1', 'action', 1, now)).toBe(false);

    limiter.remove('c1');
    // Fresh bucket for new session
    expect(limiter.consume('c1', 'action', 1, now)).toBe(true);
  });
});
