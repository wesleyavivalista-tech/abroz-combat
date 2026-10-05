# Drupa combat and light form revision

- New belly windup/impact and belly-first dive artwork for both skins. New opposite-arm second punch.
- Heavy belly knockback increased from 23 to 38.
- White Buda uses new white/blue luminous artwork and uniform 3× body scale (previously 1.8×). Punch hitboxes overlap platform height; third basic is a grounded low kick.
- Second giant basic retains its two-second charge and calls down a 210-unit-wide light column 330 units ahead, with a ground warning. This width matches the giant's torso, rather than including outstretched arms.
- Bald Head has incoming golden sunlight meeting the scalp and an outgoing reflected ray.
- Light beams use scrolling shader bands, soft edges, travelling streaks and pulsing width, driven by simulation frames.
- Belly-dive stun uses each fighter's existing hurt pose, subtle sway and three animated overhead stars for the full stun. Stars also support clones. No new dedicated stunned sprite sheets were added.
- Protocol 22 keeps clients and server on matching combat rules.

## Validation
180 tests pass, including real collision tests for all giant punches against platform opponents and low kicks against grounded opponents. Typecheck, lint and production build pass. Visually inspected both skins, belly poses, opposite punch, giant punch/low kick/sky column, scalp reflection and overhead stun in the live renderer. Existing bundle-size advisory remains.

## Art
Generated with the built-in image_gen tool. Prompts: `drupa-fixes-v2-prompts.json`.
Assets: `apps/client/public/art/drupa/combat-v2.png` and `apps/client/public/art/drupa/buda-light-v2.png`. Original assets retained. Atlas alpha ownership isolates adjacent poses without changing or stretching artwork.
