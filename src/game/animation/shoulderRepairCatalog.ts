import catalog from '../assets/assetCatalog.json';
import { DRAFT_ARM_MODELS } from './repairDraftArmSkin';

// Explicitly reviewed before/after in reports/crowd-rig-review (27 September).
// Exclusions include posed/non-human sources, large attached props and hair
// islands that regress under a generic arm correction. Do not select by rig
// bone count alone and do not expand this list without a deformation review.
export const reviewedCrowdShoulders = [
  3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 17, 20, 21, 22, 25, 29, 30, 35, 36, 38, 41, 43, 44, 45, 49, 50, 51, 54,
  55, 56, 59, 60, 61, 63, 66, 67, 68, 69, 72, 74, 76, 77, 79, 81, 84, 85, 86, 87, 88, 90,
];
export const shoulderRepairAssets = [
  ...DRAFT_ARM_MODELS.map((id) => ({ id, path: `characters/${id}/npc-animations.glb` })),
  ...catalog.festivalNpcs.filter((asset) => reviewedCrowdShoulders.includes(Number(asset.id.split('_')[0]))),
];

// Second review: higher anatomical pivot + complete clavicle cleanup.
// Hair/hat silhouettes that regressed remain on their previous profile.
export const raisedShoulderCrowd = [
  6, 9, 12, 13, 17, 22, 29, 38, 45, 49, 50, 51, 56, 63, 66, 67, 68, 69, 72, 74, 76, 77, 79, 81, 84, 85, 86,
  87, 88, 90,
];
export const raisedShoulderAssets = shoulderRepairAssets.filter(
  (asset) =>
    DRAFT_ARM_MODELS.some((id) => id === asset.id) ||
    raisedShoulderCrowd.includes(Number(asset.id.split('_')[0])),
);

export function shoulderLiftForAsset(id: string) {
  if (id === 'hemoroid') return 0.03;
  return raisedShoulderAssets.some((asset) => asset.id === id) ? 0.045 : 0;
}
