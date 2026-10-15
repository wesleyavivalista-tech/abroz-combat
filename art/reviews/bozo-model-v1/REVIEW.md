# Bozo model consistency pass

## Reference and audit

The active fighter presentation references are `portrait-user-polo-v6.png` and
`portrait-user-basketball-v6.png` in `apps/client/public/art/bozo/`.
Older briefs describe a burgundy basketball outfit; the active key art instead
has an orange/charcoal uniform. The current key art was used as the reference.

The old gameplay art had brown polo shoes, burgundy basketball clothes, white
socks, changing beard shapes, and different proportions between the main atlas
and authored walking sheets. Two basketball transition cells incorrectly wore
the polo outfit. Back-dash presentation also applied an extra 0.88 scale factor.
The shared riding sheet contained the same obsolete outfits.

## Implementation

- Eight versioned RGBA sheets (`model-*-v1.png`) generated with built-in imagegen,
  using the key art and existing poses as references. Original assets retained.
- Both 24-pose main atlases keep the existing pose indices: idle, movement,
  attacks, hair specials, armor activation, jump, crouch, guard, hit, knockout,
  victory and landing. `bozoPose` and animation timing are unchanged.
- Corrected authored near/far walks, back-dash movement, transition poses,
  descending poses and mounted poses. Alpha bounds and pelvis anchors updated.
- Uniform visual scaling uses the corrected standing references. Walking keeps
  the existing four-frame cycle and the same 1.64-unit stature.
- The obsolete six-frame walk fallback is no longer loaded by the production
  factory; the existing authored walk remains authoritative.
- Bozo's dedicated mounted pair cannot be overwritten when another fighter's
  shared mounted atlas loads. Other fighters retain their existing art.
- Existing hair-clone/armor main, movement and expansion sheets remain the
  intentionally fully hair-covered form. The descending sheet includes that
  form. Hair growth, spear deformation, clone behavior and effects are unchanged.

`alpha-audit.json` records 104 separate substantial sprite components, their
bounds, transparency, image dimensions and SHA-256 hashes. An initial generated
transition sheet joined two rows; it was rejected and regenerated with spacing.
`prompts.json` retains the available built-in generation requests.

## Validation

- TypeScript and targeted ESLint: passed.
- Full TypeScript test suite: **1,586 passed**.
- Desktop tests: **17 passed**.
- New regression coverage checks frame dimensions, both walking cycles, and all
  Bozo moves/reactions in normal, armored and clone forms without state mutation.
- Browser review: **14,316 pose updates passed** through the actual visual
  factories; visual spot checks covered idle, walking, hair spear, falling and
  mounted forms. Transparent backgrounds and feet alignment looked correct.
- Browser production build and unsigned macOS ARM64 desktop packaging: passed.
  All eight packaged images match the source files byte for byte.
- Packaged macOS training smoke test: both Bozo skins loaded; movement and a
  special attack rendered successfully against the basketball-skin dummy.
- Simulation/network source unchanged; compatibility remains `49-460a5a44`,
  protocol 49. No other fighter's assets were edited.

## Remaining visual review

The Mac locked during the final manual sweep. Every desktop animation was **not**
manually observed, and Windows/Linux were not launched. Automated pose checks
verify rendering validity and unchanged state, not exact artistic likeness or
perfect animation continuity. The regenerated art improves identity, outfit and
scale consistency, but exact key-art likeness remains an artistic review item.

Local review: `/bozo-review.html` on the development server. It supports pose and
frame selection, both skins, armor, clones, riding and light/dark backgrounds.
It is not a production build entry point. No deployment or release was made.
