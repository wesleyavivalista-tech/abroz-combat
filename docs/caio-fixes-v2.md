# Caio shadow and blood update

- Dash distance doubled from 1.25 to 2.5 times the standard dash. Directional wisps trail behind movement, including backdash.
- Dart uses a shared muzzle origin (125 forward, 145 above feet); both skin renderers align the blowgun tip to it.
- Flood lasts 1200 ticks (20 seconds), rises over 90 ticks while the caster stays squatting, and shows a rearward blood stream. The visible liquid extends beneath the arena floor into the foreground; waves use fixed world height.
- Blood Master uses dedicated painted liquid-coated sprites for both skins and all moves, including separate jab/cross sprites. Shared damage protection applies 0.9 damage while active, including melee, projectiles, beams and damage over time. Duration remains 34 seconds.
- Protocol bumped to 30 for the gameplay changes. Guide text updated.

Built-in image generation created `apps/client/public/art/caio/master-1.png`, `master-2.png` and `master-boxing.png` from the matching original movement/boxing sheets. Prompts required preserving exact poses, face, build, clothing silhouettes, layout and transparency while painting thick wet crimson blood, rivulets, drips and glossy highlights over the entire body and clothes, without injuries or a flat color filter. Boxing received a follow-up to cover remaining teal/black fabric; generated alpha transparency was verified.

Visual checks in the game renderer covered transformed cross, dart at the muzzle, flood below the floor, squatting blood source and directional dash smoke. Regression coverage includes flood rise/expiry, distance, projectile origin, reduction expiry, slow effects and rollback convergence.
