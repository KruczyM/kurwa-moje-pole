import {describe,expect,it} from 'vitest';
import {effectConfigs} from './EffectManager';

describe('LSD visual profile',()=>{
 it('uses strong saturation and a smooth three-phase lifetime',()=>{
  const lsd=effectConfigs.LSD;
  expect(lsd.saturation).toBeGreaterThanOrEqual(2);
  expect(lsd.fadeIn).toBeGreaterThan(0);
  expect(lsd.active).toBeGreaterThan(0);
  expect(lsd.fadeOut).toBeGreaterThan(0);
 });
});
