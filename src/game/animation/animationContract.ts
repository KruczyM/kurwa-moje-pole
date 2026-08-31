import contract from './characterAnimationContract.json';

export const canonicalAnimationClips = Object.freeze(Object.values(contract.clips));
export const locomotionClipNames = Object.freeze(contract.locomotion) as readonly ['Idle', 'Walk', 'Run'];
export type CanonicalAnimationClip = (typeof canonicalAnimationClips)[number];
export type LocomotionClip = (typeof locomotionClipNames)[number];

const canonicalByLowerCase = new Map(canonicalAnimationClips.map((name) => [name.toLowerCase(), name]));
const aliases = new Map(
  Object.entries(contract.aliases).map(([name, canonical]) => [name.toLowerCase(), canonical]),
);

/** Zamienia różne nazwy klipów z eksportów na kanoniczne Idle, Walk albo Run. */
export function resolveCanonicalAnimationName(name: string) {
  const normalized = name.trim().toLowerCase();
  return canonicalByLowerCase.get(normalized) ?? aliases.get(normalized);
}

export const requiredRigBones = Object.freeze(contract.rig.requiredBones);
