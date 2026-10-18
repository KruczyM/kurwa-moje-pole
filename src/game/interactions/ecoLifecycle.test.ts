import { describe, expect, it, vi } from 'vitest';
import { CanCollector } from './CanCollector';

describe('minigame-only Eko lifecycle', () => {
  it.each(['finish', 'leave'])('removes pickups after %s and never respawns them afterwards', (end) => {
    const spawned = vi.fn();
    const removed = vi.fn();
    const collector = new CanCollector({ minigameOnly: true, onCanSpawned: spawned, onCanRemoved: removed });
    expect(collector.getAllCans()).toHaveLength(0);
    expect(collector.getActiveCanMarkers()).toHaveLength(0);
    const pool = Array.from({ length: 48 }, (_, i) => ({ x: i, z: 0 }));
    collector.startEcoRound(1, pool, 1);
    const can = collector.getAllCans()[0];
    collector.collectCan(can.id, can.position);
    if (end === 'finish') collector.update(2);
    else collector.stopRush();
    collector.restoreRejectedPickup(can.id);
    collector.update(100);
    expect(removed).toHaveBeenCalledTimes(48);
    expect(spawned).toHaveBeenCalledTimes(48);
    expect(collector.getActiveCanMarkers()).toHaveLength(0);
    expect(collector.getAllCans()).toHaveLength(0);
    collector.startEcoRound(2, pool);
    expect(collector.getAllCans()).toHaveLength(48);
  });
});
