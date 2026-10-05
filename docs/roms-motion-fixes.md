# Roms motion and contact fixes

- Spin and returning balls now apply short hit reactions, combo damage, and impact events. Training previously restored their damage immediately because these contacts never caused hitstun. Spin contact remains periodic on both sides; balls retain swept collision and per-target cooldowns.
- Action selection happens before outfit selection. Armored attacks use a dedicated 16-pose combat sheet, including empty-handed axe release and catch, rather than mapping every attack to two generic poses.
- Both outfits and protective gear have separate four-phase spin, forward dash, and juggling hand sequences. Walking during juggling combines the hand cycle with the existing alternating leg cycle.
- Water collision width is 38 units (previously 80), with a tapered 54-unit mist envelope and 38-unit core. Renderer nozzle coordinates use the move's shared origin; the sprite's nozzle is anchored at atlas pixel (1196, 843).
- Protocol revision 33 requires matching client/server simulation rules.

Validation: training spin/ball regression tests, both projectile directions, armor action selection, spin and dash cycles, juggling state priority, existing Roms duration/return/replay tests, and browser rendering review at `/roms-motion-review.html`.

New asset provenance (built-in image generation, preserved originals):
- motion-1-v2: exec-44b209c3-6c66-4ed9-97c6-375d5124273f.png
- motion-2-v2: exec-87ce1d01-b045-4df7-9068-ba3aeb5cf1f1.png
- motion-gear-v2: exec-fc483faa-7577-4d19-9df8-f145088cc45a.png
- combat-gear-v2: exec-b61a40d4-2ed3-4c7d-8a62-8cfdc4b3ea7e.png

## Hose leg contact correction

Water now tests the torso and a separate wider lower-leg region (2.2 × body width, bottom 38% of height). Damage, pressure knockback, training health retention, and splash selection all use this shared test. Other beams retain their existing body coverage. Water's simulation ray also ends at the same floor/arena boundary as its visual stream. Protocol revision 34.

Added regressions for downward leg contact facing either way in training, no upper-body widening, no effect on other beams, and no contact beyond the visible stream. Full check: 231 tests passed.
