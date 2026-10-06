# Mobile UI, persistent assets and visual performance

Branch/worktree: `feat/mobile-performance`, `.ai/worktrees/mobile-performance`. No push, PR or merge.

## Existing architecture and scope

The existing Game/AnimationLoop, renderer, AssetLoader, skeletal cloning, NPC managers, Socket.io snapshots and authored Blender world remain authoritative. No extra game loop, renderer, loader or network protocol was introduced. The pre-existing menu preview and item inspection renderers remain separate.

The world is 520 × 520 units; camp plots are approximately 36 m wide and the large stage is approximately 200 m from the main camp. The authored GLB is approximately 197 MB. The full crowd is 107 actors. These dimensions informed the culling distances: landmarks cannot use the same cutoff as small decorations.

## Asset cache

- `scripts/asset-cache-plugin.ts`: Vite dev/build manifest with SHA-256 revisions for public runtime models, embedded/external texture files, audio and MIDI. Files are streamed into hashes; unchanged development files reuse hashes by size/mtime. A production build emits `asset-cache-manifest.json`.
- `public/asset-cache-sw.js`: same-origin GET interception, Cache Storage and per-file revision keys. It retains unchanged binaries and prunes superseded versions only from its own cache. The manifest is persisted so a restarted worker can restore configuration.
- `src/game/assets/persistentAssetCache.ts`: configures the worker before preview/game asset requests. Unsupported/insecure/private storage and failed configuration fall back to existing network loading. Quota errors do not discard a successfully downloaded response.
- `src/main.ts`, `index.html`: cache initialization and explicit loading explanation. Cached download does **not** mean GLB parsing, shader preparation or GPU upload is finished.
- `src/game/ui/CharacterPreview.ts`: deduplicated in-flight preview requests and retained completed sources; stale selections do not dispose a source another selection needs. Disposal still owns cloned resources and releases cached originals.

Binary files never go into localStorage. Only the quality preference is stored there. Existing AssetLoader promise caches and skeleton-safe disposable clones are retained. API requests, multiplayer messages, HTML/app shell and video/Range requests are not cached. Consequently this is not a promise that the whole application works offline. Cached audio requested through ordinary GET benefits; native range-streamed media remains network-based.

Cache Storage requires a secure context (HTTPS or localhost) and is best-effort browser storage; the browser can evict it. See [MDN CacheStorage](https://developer.mozilla.org/en-US/docs/Web/API/CacheStorage) and [Cache.put](https://developer.mozilla.org/en-US/docs/Web/API/Cache/put).

## Configurable mobile graphics

`src/game/rendering/graphicsProfile.ts` is the central configuration. Pause menu offers Auto / Low / Normal / High; desktop retains its original unlimited distances and DPR cap 2. Auto chooses Low on devices reporting ≤4 GB memory, otherwise Normal. Coarse pointers and small touch devices activate mobile graphics; large fine-pointer laptops retain desktop graphics.

| Setting                     |     Low |  Normal |    High |
| --------------------------- | ------: | ------: | ------: |
| DPR cap                     |       1 |    1.25 |     1.5 |
| Actor visibility            |    72 m |    96 m |   128 m |
| Actor animation             |    48 m |    64 m |    84 m |
| Tent batches                |   110 m |   140 m |   180 m |
| Small decoration            |    48 m |    64 m |    84 m |
| Vegetation                  |    60 m |    80 m |   110 m |
| Navigation landmarks        |   380 m |   380 m |   380 m |
| Local shadow casters        |    28 m |    36 m |    44 m |
| Sun shadow map              |     512 |     512 |    1024 |
| Static recheck interval     |  250 ms |  200 ms |  200 ms |
| Live TV resolution / FPS    | 256 / 4 | 384 / 5 | 512 / 8 |
| Bloom resolution multiplier |     0.5 |    0.65 |     0.8 |

Bounds radii extend visibility to the nearest edge of a large batch; 8 m hysteresis prevents boundary flickering. Classification uses authored placement/category metadata and names, with conservative large-batch fallback. Existing Three.js frustum culling stays enabled where already safe; no unsafe skinned bounds changes.

- `DistanceVisibility.ts`: cached bounds, throttled visual-only static culling and distance shadows. Authored dynamic parts and interaction-owned meshes are intentionally excluded to avoid resurrecting collected objects or interfering with the wheel. Interactive and particle distances are reserved in the profile but not applied indiscriminately to gameplay objects. The previous disabled procedural grass remains disabled.
- `CharacterVisibility.ts`, `NpcManager.ts`, `RemotePlayersManager.ts`: visual distance and animation gating. Logical actor movement, behavioral decisions, snapshots, interpolation, timers, voice state and map markers continue. Actors are not despawned merely because they are out of view. Near actors resume their existing animation system.
- `Game.ts`, `CampWorld.ts`: quality wiring, background crowd streaming on mobile, bounded existing loader concurrency, shadow resolution and visible-only texture warm-up. Culling happens before initial shader compilation.
- `StageLiveScreens.ts`: lower mobile feed resolution/rate using the existing renderer. TV rendering temporarily restores relevant distant scenery/actors and restores local visibility in `finally`.
- `EffectManager.ts`: compositor tracks DPR changes; only bloom buffers are additionally reduced. Existing effect identities/settings remain.

## Mobile UI and controls

`src/mobile-responsive.css` is the final override layer, retaining the original colors/fonts/visual identity. Changes cover start, loading, HUD, pause/settings, inventory, NPC dialogue, warning, map, guide, Flanki roster, Eco panel and guitar UI. Start selection uses two columns on narrow phones. Long panels scroll internally; map/header/tab layouts wrap; safe-area insets and dynamic viewport height are supported. `index.html` adds `viewport-fit=cover`.

`MobileControls.ts` reuses the existing Game key handlers for touch jump/throw and held interaction. Pointer cancellation releases held actions; event listeners remain in EventScope. Existing joystick/look and guitar lane buttons are retained. `Game.resize` also listens to visualViewport resize and resizes existing buffers without creating renderers.

## Verification

- `npm run typecheck`, lint, formatting/UTF-8 checks passed.
- 146 test files / 1378 unit tests passed with `--maxWorkers=2`; six tooling tests passed. A simultaneous heavy browser + unrestricted test run hit five existing 5-second test timeouts. No timeout thresholds or existing tests were weakened; the repeat passed.
- Asset and rig validators passed; production build passed and generated the cache manifest. Existing large-JS-chunk warning remains.
- New deterministic tests: capability detection, hysteresis, retaining actor state, visibility/animation resume, static throttling, TV restoration on thrown render, exclusion of interaction objects, successful cache hits and open/quota failure fallback.
- `scripts/verify-asset-cache.py`: actual Chromium cold storage, offline asset hit, revision replacement and reload. Report: `reports/mobile-support/cache.json`.
- `scripts/verify-mobile-support.py`: actual Chromium at 360×800, 390×844, 412×915, 768×1024, 844×390, 1024×768 and 1440×900 with emulated touch/DPR; initial/runtime/pause screenshots, panel bounds/overflow and render counters. Reports: `reports/mobile-support/before.json`, `after.json`, `final.json`.

Intermediate portrait comparison at the same camera, all 107 actors loaded:

| Metric                      |     Before | After first pass |
| --------------------------- | ---------: | ---------------: |
| Draw calls                  |       1767 |             1009 |
| Triangles                   | 10,707,956 |        4,944,948 |
| Visible meshes              |       2921 |             1811 |
| Shadow casters              |       2655 |              574 |
| Visible NPCs / logical NPCs |  107 / 107 |         65 / 107 |
| DPR                         |          2 |             1.25 |
| Mean measured frame time    |   104.9 ms |          89.2 ms |

These are desktop-host Chromium measurements with mobile emulation, not real-phone FPS. Crowd movement and live video cuts can vary counters. The first comparison also had other validation workloads, so frame-time improvement is indicative, not a controlled benchmark or a 30/60 FPS guarantee. The final repeat follows the final batch-classification/layout corrections.

## Remaining verification and bottlenecks

Final rendering repeat: portrait **995 draw calls, 4,544,900 triangles, 1791 visible meshes, 571 shadow casters, 59 visible / 107 logical NPCs, DPR 1.25, 65.7 ms mean frame**; landscape **1380 calls, 6,182,152 triangles, 51.5 ms mean frame**. A later layout-only run confirms zero panel horizontal overflow/out-of-bounds at all listed sizes, no overlap between touch interaction/jump, and a clickable pause quality selector above HUD controls. Separate fine-pointer 1440×900 desktop check retained the four-column character selector with zero overflow. Evidence: `reports/mobile-support/layout-final.json`, `desktop-start.png`, `layout-pause.png`.

`VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN`: real Android/iOS hardware, every populated dialogue/minigame state, two-player Flanki/voice, Safari storage eviction, long-session memory/GPU stability and actual phone safe-area/browser-bar behavior still require device testing. The panel geometry audit is not equivalent to playing every activity. No blanket claim that every button/gameplay state was manually verified.

The most effective next performance work is authored model LOD/decimation, lower mobile texture variants and world-chunk streaming. This patch does not regenerate models, alter rigs or change the Blender layout. Mobile still parses the large world and eventually loads the whole crowd; culling reduces drawing/animation work but does not remove their source data from memory. Static category heuristics should be checked along both passages and near the stage. Cache avoids repeat network transfers but cannot move GLTF parsing to the GPU. MP4 streaming bandwidth remains outside the persistent asset cache.
