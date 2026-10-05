# Festival NPC distribution

On branch `feat/festival-next`, streamed festival NPCs are assigned by loaded crowd index:

- First 20: persistent dancing in front of the large stage, facing its actual Blender position.
- Next 20: walking along the lower passage.
- Remaining 51: walking along the existing upper passage.

Main camp characters keep their existing behavior. Passage bounds come from exported world scenery (`Road_0`, `Road_1`), including the shifted upper passage. Dancing uses existing animation clips, delta-time updates and animation LOD; borrowed Flanki actors retain priority.

Validation: 23 NpcManager tests passed; TypeScript, ESLint and production build passed. Build retains the existing large-bundle warning. `scripts/verify-npc-distribution.py` checks actual streamed actors in a browser.

Browser verification passed: 20 dancers actively dancing, 20 lower-passage walkers, 51 upper-passage walkers; no unwalkable positions or JavaScript errors. Evidence: `reports/npc-distribution/browser-report.json`. VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN for subjective appearance and long-term crowd behavior. No push or merge performed: the worktree includes extensive previous changes and repository instructions require independent review before publication.
