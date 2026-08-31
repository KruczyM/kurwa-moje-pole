import { describe, expect, it, vi } from 'vitest';
import { EventScope } from './EventScope';

describe('EventScope', () => {
  it('removes every registered listener exactly once', () => {
    const target = new EventTarget(),
      scope = new EventScope(),
      listener = vi.fn();
    scope.listen(target, 'ping', listener);
    target.dispatchEvent(new Event('ping'));
    scope.dispose();
    scope.dispose();
    target.dispatchEvent(new Event('ping'));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(scope.size).toBe(0);
  });
});
