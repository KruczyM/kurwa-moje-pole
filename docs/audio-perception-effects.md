# Stylized consumable audio effects

Scope: camp speaker and main-stage video music. Other separate routes (voice chat, guitar synth, UI cues and ambient generators) remain unchanged so communication and rhythm timing stay readable. This is not a physiological or medical simulation.

## Research basis

- NIDA describes psychedelic changes in perception, including sound: https://nida.nih.gov/sites/default/files/rrhalluc.pdf
- NHS notes cannabis can change sensory experience: https://mft.nhs.uk/app/uploads/2021/01/Cannabis-and-mental-health.pdf
- SAMHSA describes stimulant-related hypersensitivity to sound: https://www.ncbi.nlm.nih.gov/books/NBK576548/
- NIDA describes MDMA alertness and changes in visual/time perception, not a universal acoustic filter: https://nida.nih.gov/Infofacts/clubdrugs.html
- NIAAA describes alcohol effects on brain functions, not a fixed sound signature: https://www.niaaa.nih.gov/alcohols-effects-health/alcohol-topics/health-topics-alcohol-and-brain

Exact cutoff, echo, pitch/tempo and gain choices are game design, not measurements. Experiences vary. Tobacco has only a nearly neutral cue; water/glasses remain neutral. No invented voices, tinnitus or sudden loudness increases are added.

## Implementation

Existing single game update drives deterministic profiles, scaled by existing effect fade/intensity. A lowpass and one delay tap are inserted into the existing stage audio route and a lazy speaker media route. No feedback, new update loop or duplicate media element. Convex dry/wet mix and gain <= 1 prevent this graph from boosting source peaks. Stage distance filtering, spatial pan, loading mute and user volumes remain upstream. Reduced-motion disables time-varying modulation. All owned nodes disconnect and speaker context closes on disposal.

The existing speaker playback-rate/volume effect is preserved. Stage video speed is unchanged to retain screen/audio synchronization. The filter fades back to neutral after the consumable ends.

Validation: deterministic profile tests plus existing speaker/spatial acoustics/effect tests, typecheck/lint/build. VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN (listening verification on real audio hardware, especially transitions and accessibility).
