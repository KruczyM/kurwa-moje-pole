# Guitar enhancements + mobile fog: review

Reviewed Gemini commit `ed0b7d5`; corrections committed as `416bc95` and integrated
into `feat/mobile-fog-trial` in `625bbe8`. Integration and the final merge were
explicitly requested by the user. No paid AI APIs or credentials were used.

## Findings corrected

- Quality gates: five ESLint errors and formatting errors in six files.
- Forced 21:9 default: on a portrait phone this reduced the game to a narrow
  strip. The default is now native/fullscreen; cinematic formats remain optional.
  Preset validation rejects inherited object properties. Resize invalidation
  includes viewport offsets, not only dimensions.
- Guitar NPC throttling caused coarse animation/movement steps. Normal existing
  delta-time updates are retained. TV camera updates and visibility culling no
  longer stop while the guitar UI is open.
- Backing treated sorted MIDI pitch names as a chord progression and played
  fallback notes. It now follows the chart's current pitch. Pitch parsing includes
  octave -1. Supplied charts retain relative timing but start after 2.5 seconds,
  instead of waiting up to almost two minutes for the selected MIDI voice.
- Backing sources/filters/gains are disconnected on completion; active backing
  stops on exit, its shaker buffer is reused, and stalls do not stack missed beats.
- Stable guitar callbacks avoid rebinding controls each frame. The minigame clock
  does not advance while the app is paused or a help/menu overlay changes state.
- Integration preserves fog range settings, sector streaming, original near-field
  assets, low-FPS movement correction, and contextual SKOK/RZUT controls.
- Browser scripts use repository-local ignored reports rather than a private
  Gemini directory. The aspect test uses the actual settings storage key.

## Validation

- `npm run ci:code`: passed; 1,416 unit tests and six tool tests.
- `npm run build`: passed; existing large-bundle warning remains.
- `npm run ci:assets`: passed; assets, rigs and 207 fog sectors validated.
- `python scripts/verify-mobile-fog-controls.py`: Chromium and WebKit with iPhone
  13 touch emulation passed: real campfire interaction, five touch lanes, scored
  input, exit/voice cleanup, menu, saved fog ranges, SKOK/RZUT and reload.
  No page errors. Reports and screenshots: `reports/mobile-fog-controls/`.
- `python scripts/verify-aspect-ratio.py`: full screen, 21:9, 4:3 and 32:9,
  settings persistence and pause menu passed; screenshots inspected.
- `python scripts/verify-motion-camera-framing.py`: cheering/dancing, wide frame
  and return to play passed; cheering screenshot inspected.
- `python scripts/verify-guitar-5lanes.py`: five lanes, keyboard input, backing,
  stage playlist and exit passed both with the fog trial enabled and with
  `GAME_QA_URL` selecting `fogTrial=0` (the original full desktop world).

This is desktop browser engine/device emulation, not real iPhone GPU/memory or
frame-rate certification. Physical-device endurance/performance verification is
`VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN`. No guarantee of crash-free play on
all phones is implied. MIDI files supplied by the user retain their existing
unverified-license labels; no new copyrighted recordings were downloaded.
