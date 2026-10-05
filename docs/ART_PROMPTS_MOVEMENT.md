# Movement artwork

Built-in image_gen mode. Reference: each fighter's existing pixel-v1 atlas.

Saved assets:
- apps/client/public/art/prototype-a-movement-v1.png
- apps/client/public/art/prototype-b-movement-v1.png

Each sheet contains four guarded walk frames, two forward dash frames and two backward dash frames. Walking reverses and slows for backward movement. Dash sequences follow the existing 12-tick simulation duration. Individual bounds and body pivots keep feet grounded without resizing crouched dash poses to standing height.

Exact prompt (used for both fighters, with their corresponding reference sheet):

Use case: identity-preserve. Create a supplemental MOVEMENT sprite atlas for exactly the fighter in the supplied reference. Preserve exact face, outfit, colors, pixel art scale, bold dark outlines and detailed pixel shading. Transparent alpha background, NO checkerboard, shadows, effects or text. Exactly 8 full-body sprites in FOUR columns and TWO rows, generous margins, no overlap. All face RIGHT, same body proportions and head size throughout. Top row is FOUR consecutive frames of a smooth guarded WALK cycle: (1) left foot forward contact, (2) legs passing beneath hips with rear heel raised, (3) right foot forward contact, (4) opposite legs passing beneath hips. Upper torso stays upright and fists stay in consistent boxing guard, head height constant, small natural motion. Feet alternate between wide and narrow stance. Do not substitute idle poses. Bottom row: (1) explosive forward dash, torso leaning strongly RIGHT, front knee bent and rear leg stretched behind; (2) second forward dash stride with legs swapped, same low torso lean; (3) guarded BACKDASH traveling LEFT but looking RIGHT, body leaning slightly LEFT with right leg pushing off; (4) backdash landing looking RIGHT, knees bent absorbing motion and hands guarding face. Each cell uses same pixel scale, feet on common baseline near 88% cell height. Canvas wide 2:1. Match the reference exactly in character design and detailed arcade pixel style.
