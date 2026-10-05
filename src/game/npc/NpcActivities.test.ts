import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { NpcAnimator } from './NpcAnimator';
import { NpcManager } from './NpcManager';
import { NpcNavigationGrid } from './NpcNavigationGrid';

function create() {
  return new NpcAnimator(
    new THREE.Group(),
    ['Idle', 'Walk', 'Run', 'LieDown', 'LayingIdle', 'StandUpFromLaying', 'Waving'].map(
      (name) => new THREE.AnimationClip(name, 1, []),
    ),
    { fadeSeconds: 0 },
  );
}
describe('NPC rest sequences', () => {
  it('keeps the navigation anchor still for the whole activity', () => {
    const manager = new NpcManager(
      new THREE.Scene(),
      new Map(),
      null,
      new NpcNavigationGrid({ minX: -20, maxX: 20, minZ: -20, maxZ: 20 }, 1, () => true),
    );
    const npc = manager.npcs[0];
    npc.animator = create();
    npc.behavior.forceWander();
    npc.target.set(10, 0, 10);
    npc.animator.startActivity([{ name: 'LayingIdle', seconds: 4 }]);
    const initial = npc.root.position.clone();
    for (let i = 0; i < 30; i++) manager.update(0.1, i / 10);
    expect(npc.root.position).toEqual(initial);
    expect(npc.velocity.length()).toBe(0);
    expect(npc.animator.activityActive).toBe(true);
    manager.dispose();
  });
  it('blocks walking through enter, hold and exit, then resumes the requested motion', () => {
    const animator = create();
    expect(
      animator.startActivity([
        { name: 'LieDown' },
        { name: 'LayingIdle', seconds: 5 },
        { name: 'StandUpFromLaying' },
      ]),
    ).toBe(true);
    animator.play('Walk');
    animator.update(1.01);
    expect(animator.getDiagnostics().currentClip).toBe('LayingIdle');
    animator.update(2);
    expect(animator.activityActive).toBe(true);
    animator.endActivityHold();
    animator.update(0.01);
    expect(animator.getDiagnostics().currentClip).toBe('StandUpFromLaying');
    animator.update(1.01);
    expect(animator.activityActive).toBe(false);
    expect(animator.getDiagnostics().currentClip).toBe('Walk');
    animator.dispose();
  });
  it('rejects unavailable or invalid sequences without disrupting the current action', () => {
    const animator = create();
    expect(animator.startActivity([{ name: 'absent' }])).toBe(false);
    expect(animator.startActivity([{ name: 'Waving', seconds: NaN }])).toBe(false);
    expect(animator.startActivity([{ name: 'Waving' }])).toBe(true);
    expect(animator.startActivity([{ name: 'LieDown' }])).toBe(false);
    expect(animator.queueOneShot('Waving')).toBe(false);
    animator.update(1.01);
    expect(animator.activityActive).toBe(false);
    animator.dispose();
  });
});
