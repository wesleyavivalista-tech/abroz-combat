# Guarded movement and clone hit-stop

Tocha and Bozo now use new four-pose walking cycles and four-phase backward dashes: load, hop, landing catch and recovery. Both skins and Bozo's hair clones/armor have dedicated artwork. Backward walking reverses the cycle at a slower cadence. Simulation ticks drive the animation rather than world position; facing changes, rollback corrections, and pause no longer change the pose unexpectedly. Measured crop bounds, pelvis anchors and a constant body scale keep the art aligned. The existing sprite isolation mask also protects these sheets against neighboring artwork.

Assets (generated with built-in imagegen):
- `apps/client/public/art/tocha/movement-v2.png`
- `apps/client/public/art/bozo/movement-v2.png`
- `apps/client/public/art/bozo/clone-movement-v2.png`

Exact prompts are recorded in `movement-v2-prompts.json` and `clone-movement-prompt.txt`.

Clone contacts previously set the same global hit-stop as player attacks. Staggered clone hits repeatedly paused every fighter. Contacts involving companions now retain damage, guard, hit reactions and impact effects without creating global hit-stop or strong camera shake. Player-to-player hit-stop is unchanged. Protocol version 8 prevents older online clients from joining with different combat rules.

Validation covers simulation-time walking, both skins, clone and armored movement, airborne back-dash frames, atlas restoration on attacks, hits/blocks involving clones, unrelated player movement, sustained six-player/18-clone combat, and existing online rollback convergence in 2v2/3v3. All five visual variants were inspected with the real game renderers for grounded walking and backward hops.
