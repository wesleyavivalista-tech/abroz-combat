# White Buda complete rebuild

All transformed poses now use one sixteen-pose atlas, one uniform anatomical scale and body pivots. Rebuilt guard, walk, punch, kick, sky-call, lotus, jump, dash, hurt and crouch artwork. Removed runtime switching between separate light and upright sheets. White sprite brightness stays below the scene bloom threshold to avoid softening its outlines.

- Transformation: 20 to 26 seconds.
- Super White Buda Beam: 16 to 18 damage per tick (+12.5%); retains 13-second duration and 55-unit width.
- Second basic: hold Medium through the one-second charge to emit a continuous descending beam. Width increases from 210 to 300 units; deals 24 damage every 12 simulation ticks with no hitstop, stun or push. Releasing cancels charging or emission, then enters recovery. Transformation expiry, interruption and defeat end the move.
- Protocol 24 synchronizes the new rules online.

Built-in image generation asset: `apps/client/public/art/drupa/buda-complete-v4.png`. Exact prompt: `buda-v4-prompt.txt`.

Validation covers continuous damage, charge cancellation, release, transformation expiry and rollback; all transformed movement states use the same atlas and scale. Live renderer inspection covered idle/walk/punch/kick/sky beam and held damage followed by release.
