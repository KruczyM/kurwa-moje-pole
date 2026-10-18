import { describe, expect, it } from 'vitest';
import { NPC_BEHAVIOR_PROFILES, NpcBehaviorScheduler } from './NpcBehaviorScheduler';

const CALM = {
  initialIdleSeconds: 1,
  idleSeconds: [1, 1] as const,
  socialSeconds: [2, 2] as const,
  socialChance: 0,
};

describe('NpcBehaviorScheduler', () => {
  it('staggers the first decisions using independent character profiles', () => {
    const schedulers = NPC_BEHAVIOR_PROFILES.map(
      (profile, index) => new NpcBehaviorScheduler(profile, 100 + index),
    );

    const actions = schedulers.map((scheduler) =>
      scheduler.update(2, {
        nearEdge: false,
        insideSafeZone: true,
        arrived: true,
        socialAvailable: true,
      }),
    );

    expect(actions.filter(Boolean).length).toBeGreaterThan(0);
    expect(actions.filter(Boolean).length).toBeLessThan(schedulers.length);
  });

  it('rotates wander targets through sectors instead of oscillating between recent goals', () => {
    const scheduler = new NpcBehaviorScheduler(CALM, 42);
    const sectors = Array.from({ length: 4 }, () => scheduler.nextSector(9));

    expect(new Set(sectors).size).toBe(4);
  });

  it('runs home only near the edge and returns to idle inside the safe zone', () => {
    const scheduler = new NpcBehaviorScheduler(CALM, 7);
    const normal = scheduler.update(0.1, {
      nearEdge: false,
      insideSafeZone: false,
      arrived: false,
      socialAvailable: false,
    });
    const escape = scheduler.update(0.1, {
      nearEdge: true,
      insideSafeZone: false,
      arrived: false,
      socialAvailable: false,
    });
    const safe = scheduler.update(0.1, {
      nearEdge: false,
      insideSafeZone: true,
      arrived: false,
      socialAvailable: false,
    });

    expect(normal).toBeNull();
    expect(escape).toBe('run-home');
    expect(safe).toBe('idle');
    expect(scheduler.state).toBe('idle');
    expect(scheduler.travelling).toBe(false);
  });

  it('does not immediately re-enter run-home during its cooldown', () => {
    const scheduler = new NpcBehaviorScheduler(CALM, 8);
    scheduler.update(0.1, {
      nearEdge: true,
      insideSafeZone: false,
      arrived: false,
      socialAvailable: false,
    });
    scheduler.update(0.1, {
      nearEdge: false,
      insideSafeZone: true,
      arrived: false,
      socialAvailable: false,
    });
    const action = scheduler.update(1, {
      nearEdge: true,
      insideSafeZone: false,
      arrived: false,
      socialAvailable: false,
    });

    expect(action).toBeNull();
    expect(scheduler.state).toBe('idle');
  });

  it('visits varied sectors during a deterministic ten-minute schedule', () => {
    const schedulers = NPC_BEHAVIOR_PROFILES.map(
      (profile, index) => new NpcBehaviorScheduler(profile, 2_000 + index),
    );
    const visited = schedulers.map(() => new Set<number>());
    const firstWanderSector = schedulers.map(() => -1);
    const actionTimes = new Set<string>();

    for (let tick = 0; tick < 1_200; tick += 1) {
      schedulers.forEach((scheduler, index) => {
        const action = scheduler.update(0.5, {
          nearEdge: false,
          insideSafeZone: true,
          arrived: scheduler.travelling,
          socialAvailable: index % 3 === 0,
        });
        if (action) actionTimes.add(`${tick}:${action}`);
        if (action === 'wander') {
          const sector = scheduler.nextSector(9);
          visited[index].add(sector);
          if (firstWanderSector[index] < 0) firstWanderSector[index] = sector;
        }
      });
    }

    expect(visited.every((sectors) => sectors.size >= 6)).toBe(true);
    expect(new Set(firstWanderSector).size).toBeGreaterThan(1);
    expect(actionTimes.size).toBeGreaterThan(20);
  });

  it('triggers dance when music is playing and canDance is available', () => {
    const scheduler = new NpcBehaviorScheduler(CALM, 1);
    // Fast forward initial idle
    scheduler.update(2.0, {
      nearEdge: false,
      insideSafeZone: true,
      arrived: true,
      socialAvailable: false,
      speakerPlaying: true,
      canDance: true,
    });

    // Advance ticks to trigger dance
    let danced = false;
    for (let i = 0; i < 60 && !danced; i++) {
      const action = scheduler.update(0.5, {
        nearEdge: false,
        insideSafeZone: true,
        arrived: scheduler.travelling,
        socialAvailable: false,
        speakerPlaying: true,
        canDance: true,
      });
      if (action === 'dance' || scheduler.state === 'dance') {
        danced = true;
      }
    }
    expect(danced).toBe(true);
  });

  it('triggers sit when chair is available and vacates when player approaches', () => {
    const scheduler = new NpcBehaviorScheduler(CALM, 2);
    // Fast forward initial idle
    scheduler.update(2.0, {
      nearEdge: false,
      insideSafeZone: true,
      arrived: true,
      socialAvailable: false,
      seatAvailable: true,
    });

    let sat = false;
    for (let i = 0; i < 60 && !sat; i++) {
      const action = scheduler.update(0.5, {
        nearEdge: false,
        insideSafeZone: true,
        arrived: scheduler.travelling,
        socialAvailable: false,
        seatAvailable: true,
      });
      if (action === 'sit' || scheduler.state === 'sit') {
        sat = true;
      }
    }
    expect(sat).toBe(true);

    // Now arrive at seat
    scheduler.travelling = true;
    scheduler.update(0.1, {
      nearEdge: false,
      insideSafeZone: true,
      arrived: true,
      socialAvailable: false,
    });
    expect(scheduler.state).toBe('sit');

    // Player approaches chair
    const standAction = scheduler.update(0.1, {
      nearEdge: false,
      insideSafeZone: true,
      arrived: false,
      socialAvailable: false,
      playerNearSeat: true,
    });
    expect(standAction).toBe('idle');
    expect(scheduler.state).toBe('idle');
  });
});
