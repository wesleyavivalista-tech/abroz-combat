# Drupa

Both approved skins are playable: red varsity and heavyweight purple shirt.

- Three-press swing / return swing / belly chain, heavy belly knockback and standalone wide swing.
- Double-jump + second basic performs a belly-first dive, with 120 ticks of stun on hit.
- Rolling crosses to the arena edge and hits each opponent once.
- Bald head fires a forward light beam.
- White Buda Beam floats and fires for 480 ticks (8 seconds). Up/down movement inputs steer the beam. Continuous damage does not pause the match, stun or push targets.
- White Buda Transformation lasts 1200 ticks (20 seconds), takes 60% incoming damage and moves at 80% speed. Its only attacks are the swing chain, a forward beam with 120-tick charge and an upward beam.
- Transformation changes visible size and hurtbox together. Death and expiration clear it.

Artwork was generated with built-in imagegen. Source prompts: drupa-art-prompts.json. Runtime assets: apps/client/public/art/drupa (portraits, both 16-pose atlases, eight-pose White Buda atlas). Poses use uniform sizing and isolated alpha masks, with no body deformation.

Gut spear regression: the body material now returns to its base atlas after walking, keeping its texture and pose mask in agreement. Regression coverage checks both skins, both facings, and walking-to-idle/attack/air transitions.

Validation: typecheck, lint, combat and rendering tests; production build; browser checks of both skins, White Buda forms/beam, rolling, and Gut spear transitions. Network protocol 21 includes the replayable beam aim state.

