# Consumable camera and Eko lifecycle repair

- Feature branch: feat/festival-next; no push or merge.
- Item-use actor faces the selected cinematic camera, including blocked-path fallback. Placement uses terrain height rather than the airborne/bobbing FPS camera. Skinned bounds are refreshed after applying Idle before fitting the actor.
- Original EffectManager drug configurations remain present. Mushroom wireframe was introduced in 7c35e5e and modified in 0e1512a; current EffectManager changes did not remove its configuration. Matrix and mushroom material swaps could overlap and restore each other's temporary materials. Mushroom now exclusively owns wireframe during its effect; accessibility settings are preserved.
- Game starts with no collectible trash. Active solo/race rounds create pickups; timeout/leave clears pickups, interactions, map markers and respawn timers via existing world callbacks. Late rejected server pickups cannot revive a cleared round. Permanent recycling stations remain.
- Deterministic camera-facing/airborne-origin and Eko timeout/leave/restart regressions added.
- VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN: actual character meshes, all consumable animations and wireframe appearance still need visual gameplay confirmation.
