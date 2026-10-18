import { expect, it } from 'vitest';
import { shouldAdvancePausedSharedWorld } from './sharedWorldPolicy';

it('keeps shared matches running behind local menus but preserves offline pause and avoids double stepping', () => {
  expect(shouldAdvancePausedSharedWorld('paused', true)).toBe(true);
  expect(shouldAdvancePausedSharedWorld('paused', false)).toBe(false);
  expect(shouldAdvancePausedSharedWorld('playing', true)).toBe(false);
  expect(shouldAdvancePausedSharedWorld('error', true)).toBe(false);
});
