# NPC 019 — rejected repair experiments

The runtime model AND `source-assets/rigged-festival/019_punk_spikes_bracelets/t-pose.glb` contain the same lowered-arm dinosaur silhouette, not the expected punk. The source rig is already malformed in motion; restoring that source does not fix it.

Experiments rendered using actual Three.js skinning and Blender 5.2:

- `reports/npc019-pose65`: 65 degree arm compensation, Cheering. Rejected: severe torso pulling remains.
- `reports/npc019-weights`: candidate anatomical weights plus arm compensation. Rejected: torso improves but arms/shoulders stretch and lose the intended silhouette.
- `reports/npc019-source-view`: original rigged source, Walk. Rejected: severe torso folds.

No model was installed. Runtime motion-bank behavior was restored. `--dinosaur-weights` in the geometry audit is an experimental offline-only flag and is not a runtime fix. It must not be applied to other models. The experimental 65 degree compensation is no longer enabled in runtime code.

Next required step: fit shoulder/elbow/wrist joint locations to the actual lowered-arm mesh and regenerate bind matrices and weights together. Weight-only or pose-only corrections have failed. Preserve source files and write a candidate separately; validate Idle, Walk, Run and raised-arm clips before installation. Also resolve the source identity mismatch before presenting NPC 019 as the punk character.

VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN

## Follow-up, 2026-10-03

Found and fixed a concrete rerigging error: GLB import adds a bone-display
helper mesh. Including it in body bounds shifted the exported body floor to
0.7101 m and placed leg joints outside the body. The lowered-dinosaur path now
uses the existing canonical_objects/remove_base_helpers mechanism before
normalization. Transforms are assigned explicitly and geometry is updated.
The exporter now reimports its artifact and rejects non-grounded/non-2.45 m
body geometry. Originals and runtime GLBs are unchanged.

Offline heat-weighting experiments also weld positional seams, retaining loop
UVs. This removes the heat solver warning, but is NOT proof of visual quality.
Walk renders still show unacceptable garment/torso deformation, both with heat
weights and with hand-coded anatomical weights. Rejected candidates:
`reports/npc019-welded2`, `reports/npc019-anatomy2`,
`reports/npc019-no-offset`. Do not install or batch-apply them.

## Follow-up, 2026-10-04

The fitted arm joints were behind the visible arms. Moved the arm chain forward
and down to the lowered silhouette. Diagnosed a second problem using individual
stretched edges: neighbouring sleeve/garment vertices alternated their fourth
influence between Hand and Hips, while heat diffusion also assigned thigh
weights to the torso. Added NPC019-only smooth anatomical masks before the
four-influence limit, plus an explicit fallback when all heat influences are
rejected. Never retain the old remote influences in that case.

The candidate is substantially better in Walk, but Run still has waist/pelvis
folds and Cheering stretches the armpit/sleeve transitions. Runtime asset remains
unchanged. Latest reproducible candidate:
`reports/npc019-smoothed-candidate-20261004/corrected/npc_models/019_punk_spikes_bracelets.glb`.
It contains baked topology smoothing and explicit 66-degree pose metadata;
images and other binary channels are not reserialized by the smoothing pass.

The audit now accepts AUDIT_TIMES (e.g. 0,0.2,0.4,0.6) and --smooth-only to
separate smoothing from the heuristic reweighting pass. The weight repair tool's
--smooth-candidate path is restricted to NPC019 and explicitly forbids install.

Re-ran the read-only deformation audit for all 107 runtime models:
`reports/npc-deformation-20261004/report.json`. This is a risk ranking, NOT
visual acceptance. Highest stretch samples remain Klatwa, blue alien 050,
Gruczol, NPC019, bubble blower 026 and shaman 044. Some extremes concern props
or garment edges, so do not rerig those models indiscriminately.

Next: resolve the pelvis/waist transition, then compare textured front/side
Idle/Walk/Run/Cheering before installing. No runtime model was replaced today.
VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN
