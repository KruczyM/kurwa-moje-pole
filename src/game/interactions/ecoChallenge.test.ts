import { describe, it, expect } from 'vitest';
import { CanCollector } from './CanCollector';
import { ecoPosition, ecoPickupPoints, ecoWaveMultiplier } from './ecoChallenge';
const pool = Array.from({ length: 96 }, (_, i) => ({ x: i, z: 0 }));
describe('Private Eko objects', () => {
  it('caps sprint at +35%, awards bundles and doubles points only during waves', () => {
    const collector = new CanCollector();
    collector.startEcoRound(1, pool);
    const pick = (index: number) => {
      const can = collector.getAllCans().find((c) => c.id === `eco_${index}`)!;
      collector.collectCan(can.id, { x: can.position[0], z: can.position[2] });
    };
    pick(11);
    expect(collector.getSpeedBoostMultiplier()).toBe(1.35);
    expect(collector.getSpeedBoostRemaining()).toBe(12);
    pick(23);
    expect(collector.getSpeedBoostMultiplier()).toBe(1.35);
    pick(5);
    expect(collector.getRushStats().cansCollected).toBe(5);
    collector.update(20);
    expect(collector.getSpeedBoostMultiplier()).toBe(1);
    expect(collector.getEcoWaveMultiplier()).toBe(2);
    pick(17);
    expect(collector.getRushStats().cansCollected).toBe(11);
    collector.restoreRejectedPickup('eco_17');
    expect(collector.getRushStats().cansCollected).toBe(5);
    expect(ecoWaveMultiplier(30)).toBe(1);
    expect(ecoPickupPoints(5, 29.9)).toBe(6);
  });
  it('uses the same seed on each client with independent collections', () => {
    const a = new CanCollector(),
      b = new CanCollector();
    a.startEcoRound(123, pool);
    b.startEcoRound(123, pool);
    expect(a.getAllCans()).toEqual(b.getAllCans());
    expect(a.getAllCans()).toHaveLength(48);
    const can = a.getAllCans()[0];
    expect(a.collectCan(can.id, { x: can.position[0], y: 0, z: can.position[2] })).toBe(true);
    expect(b.getAvailableCans()).toHaveLength(48);
    a.update(4.1);
    const respawn = a.getAllCans().find((c) => c.id === can.id)!;
    expect(respawn.generation).toBe(1);
    expect(respawn.position[0]).toBe(ecoPosition(123, 0, 1, pool).x);
  });
  it('restores rejected pickups and expires solo rounds', () => {
    const collector = new CanCollector();
    collector.startEcoRound(1, pool);
    const can = collector.getAllCans()[0];
    collector.collectCan(can.id, { x: can.position[0], y: 0, z: can.position[2] });
    collector.restoreRejectedPickup(can.id);
    expect(collector.getInventoryCount()).toBe(0);
    expect(collector.getRushStats().cansCollected).toBe(0);
    expect(collector.getAvailableCans()).toHaveLength(48);
    collector.update(181);
    expect(collector.isRushActive()).toBe(false);
  });
});
