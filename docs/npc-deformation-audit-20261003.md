# NPC deformation audit — 2026-10-03

## Scope and result

Read-only numeric audit completed for 107 runtime character assets: 16 selectable characters and 91 festival NPCs. Each model uses `repairSkinSeams` and `FestivalMotionBank`, matching the loader. Every resulting clip was sampled at 5%, 35%, 65% and 95% of its duration. Up to approximately 600 triangle edges per mesh were measured relative to their neutral length. This samples deformation; it is not exhaustive visual verification, transition testing, or an acceptance criterion by itself.

No invalid normalized skin weights were found by this pass. Large local stretch outliers remain. The existing 108 motion-bank/locomotion tests pass but do not establish visual correctness.

Largest sampled edge ratios (not whole-character scale):

| Asset                     | Clip                 | Ratio |
| ------------------------- | -------------------- | ----- |
| klatwa                    | DrunkRunningLeftTurn | 52.8  |
| 050_blue_alien_girl       | DrunkRunForward      | 49.2  |
| gruczol                   | SneakWalk            | 42.1  |
| 019_punk_spikes_bracelets | Cheering             | 33.0  |
| 026_bubble_blower_hippie  | DrunkRunningLeftTurn | 30.0  |
| 044_hippie_shaman_beads   | WalkingVariant       | 28.5  |

## Visual evidence

Blender 5.2.2 LTS was detected and used without adding plugins. Clay renders of actual Three.js-skinned poses, not Blender-retargeted substitutes, were inspected for 019, 050 and 080 in neutral and Cheering poses. 019 contains a dinosaur-shaped mesh with lowered arms; Cheering folds its torso badly. A rest-pose mismatch is a leading hypothesis, not yet a validated fix. 050 also shows lower-body stretching. Do not apply a blanket weight smoothing pass to all assets.

Local artifacts: `reports/npc-deformation-20261003/report.json` and `reports/npc-deformation-20261003/visual/grid.png`. Reproduce the numeric report with `npx tsx scripts/audit-npc-deformation.ts`.

## Changes and remaining work

Zawor's menu now uses the original unskinned `characters/zawor/preview.glb`, with no action playing, as previously requested. Gameplay assets are unchanged. Its static preview regression test and the other preview tests pass (17 tests).

NPC weights and animation retargeting have NOT yet been repaired by this audit. Next validate the 019 rest-pose mapping, then inspect the high-ranking cases at multiple times and from front/side/back before installing any correction. Preserve faces, clothing and held props independently. Full texture/gameplay review remains outstanding.

VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN
