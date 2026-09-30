# Zawór: clothing weights investigation, 2026-09-29

Status: incomplete; candidate NOT installed. The runtime GLB retains the previous shoulder repair.

The garment shares its principal connected component with the body. Texture sampling plus welded adjacency separates most of the poncho, but a height-only mask truncates tassels and dark shorts are easily misclassified. The experimental mask also uses depth below the hem to protect the shorts.

New diagnostic tools:

- `scripts/inspect-zawor-cloth.ts`: welded component inspection.
- `scripts/blender/sample-glb-colors.py`: sample embedded texture at vertex UVs, read-only.
- `scripts/build-zawor-cloth-mask.ts`: experimental vertex mask and highlighted neutral mesh.
- `scripts/repair-zawor-cloth-weights.ts`: offline mask/hash-validated weight candidate.
- `scripts/repair-character-weights.ts --zawor-cloth`: writes a separate candidate; `--install` is intentionally blocked.

Artifacts under `reports/zawor-cloth-analysis`, `reports/zawor-cloth-weights-20260929`, `reports/zawor-cloth-menu`, and `reports/zawor-cloth-run` are local diagnostics, not runtime assets.

Actual Three.js skinning was baked for the current menu pose and Run at t=0.4 and rendered as clay in Blender. The lower hem is more stable, but side fringe roots still stretch and the raised thigh intersects the rigid torso-attached hem. Therefore this candidate must not replace the runtime model.

Next: identify complete individual fringe strands and assign each a consistent root attachment, smoothly blend the garment surface at the shoulder seam, then validate multiple times in Idle, Walk and Run, front/back/side. Do not hide deformation by changing the menu pose or rigidifying the whole model.

VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN. No browser gameplay or textured runtime verification was performed.
