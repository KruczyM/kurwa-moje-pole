import { describe, expect, it } from 'vitest';
import {
  canonicalAnimationClips,
  locomotionClipNames,
  requiredRigBones,
  resolveCanonicalAnimationName,
} from './animationContract';

describe('character animation contract', () => {
  it('contains the complete runtime library', () => {
    expect(canonicalAnimationClips).toHaveLength(13);
    expect(locomotionClipNames).toEqual(['Idle', 'Walk', 'Run']);
  });

  it('normalizes canonical names and Mixamo aliases', () => {
    expect(resolveCanonicalAnimationName(' idle ')).toBe('Idle');
    expect(resolveCanonicalAnimationName('Idle Neutral')).toBe('Idle');
    expect(resolveCanonicalAnimationName('Walking')).toBe('Walk');
    expect(resolveCanonicalAnimationName('Running')).toBe('Run');
    expect(resolveCanonicalAnimationName('unknown')).toBeUndefined();
  });

  it('requires the core humanoid chain', () => {
    expect(requiredRigBones.hips).toBe('mixamorig:Hips');
    expect(requiredRigBones.leftHand).toBe('mixamorig:LeftHand');
    expect(requiredRigBones.rightFoot).toBe('mixamorig:RightFoot');
  });
});
