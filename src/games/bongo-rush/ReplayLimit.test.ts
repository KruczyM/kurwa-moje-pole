import { describe, expect, it } from 'vitest';
import { replayLimit } from '../../../scripts/bongo-v6/replay-limit';

describe('offline replay bounds', () => {
  it('replays the entire route when an optional bound is followed by a flag', () => {
    expect(replayLimit('--geometry=proposal.json', 296)).toBe(296);
    expect(replayLimit('--pickups', 296)).toBe(296);
    expect(replayLimit(undefined, 296)).toBe(296);
  });
  it('preserves explicit zero and partial bounds', () => {
    expect(replayLimit('0', 296)).toBe(0);
    expect(replayLimit('79', 296)).toBe(79);
  });
  it.each(['-1', '1.5', 'NaN', 'Infinity', 'oops'])('rejects malformed bound %s', (value) => {
    expect(() => replayLimit(value, 296)).toThrow('Invalid replay bound');
  });
});
