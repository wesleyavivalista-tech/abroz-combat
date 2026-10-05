# Drawn alternating walk cycle

Replaced the repeated-leading-leg walking loops with four explicit drawn key poses: near-leg contact, far-leg passing, far-leg contact, near-leg passing. Both skins of Tocha, Bozo and Gut use the corrected cycle, as do Bozo's clones/armor and Gut's spear mode. Backward walking reverses the sequence. These are full-body sprites; the rejected procedural walking rig remains removed. Rendering only crops and uniformly scales intact artwork.

The two halves were generated separately so the hip and knee overlaps actually reverse. The final near and far sheets share upper-body appearance and stride dimensions. Runtime isolation excludes neighboring artwork; source-space grip coordinates keep Gut's fixed-length spear attached to his hands. Standing, attack, dash and special artwork remains on its existing paths.

Gut's selection portrait now has a -3.5% vertical offset, inherited by both skins, to align its head with Tocha's.

## Saved artwork

Built-in image_gen was used. Final assets are in `apps/client/public/art/walk-correction/`:

- `tocha-near.png`, `tocha-far.png`
- `bozo-near.png`, `bozo-far.png`
- `gut-near.png`, `gut-far.png`
- `clone-near.png`, `clone-far.png`
- `spear-near.png`, `spear-far.png`

The accepted generation/edit prompts are saved in [authored-walk-prompts.json](authored-walk-prompts.json). Discarded sheets that repeated the same leading leg were not integrated.

## Validation

- Browser review at full-size rendering: contact and passing poses, both skins, clone and spear variants; standing comparison; backward playback; selection portrait alignment.
- No browser errors during the animation review.
- 168 automated tests pass, including new tests for immutable sprite geometry, preserved aspect ratio, deterministic frames and fixed spear length/grip.
- Typecheck, lint and production build pass. Existing bundle-size advisory remains.

This is a four-key-pose sprite cycle, not continuous skeletal animation. Visual quality was reviewed separately from automated checks.
