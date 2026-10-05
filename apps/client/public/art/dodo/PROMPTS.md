# Dodo gameplay artwork

Generated using the built-in image generator from the approved Dodo model references. Approved portraits are copied unchanged from the review's approved folder.

## Fighter atlas brief
Transparent 4×4 animation sheet, consistent proportions and identity, full figure within every cell, facing right. Preserve the approved face, salt-and-pepper hair, beard, long torso and white single-cut guitar with black pickguard. Skin 1 wears the leaf-print shirt and black shorts; skin 2 wears the plain black T-shirt and beige shorts. Both wear black All Stars. Cells: idle, four alternating walking poses, punch, kick, guitar swing, heavy windup, low attack, airborne, guard, hit, knocked down, strumming, victory.

## Basketball companions
Game sprite atlas of three distinct adult male basketball fighters wearing the reference burgundy/black chevron PAINKILLERS basketball sleeveless jerseys, matching shorts and basketball shoes. Polished cel-shaded 2D fighting game style. Transparent background, no grid lines, no extra labels. EXACT 4 columns x 3 rows of equal rectangular cells. All figures right-facing, full body in each cell, consistent scale, feet at cell bottom with margin, never cross cells. Row 1 a white man short brown hair, jersey number 11; row 2 a Black man with cropped black hair number 23; row 3 an East Asian man short black hair number 34. For each row same man in four poses: column1 ready guard standing, column2 walking left leg forward/right back, column3 walking right leg forward/left back, column4 arm fully extended throwing an orange basketball/punching forward. Broad empty gaps. No guitar. Make each face and hairstyle distinct. Readable PAINKILLERS on chest and unique jersey numbers.

## Companion punch atlas brief
Use the generated companion sheet as reference. Transparent 4×3 sheet preserving the same three players, uniforms and numbers. Each row has guard, jab, cross and hook. No basketball in these frames. Keep consistent cell placement and scale.


## September 25 gameplay corrections
The runtime now isolates complete connected silhouettes into per-pose textures, including limbs extending across nominal grid cells. Atlas cells are not used as clipping rectangles. New companion sheets replace the earlier anime-like drawings. Dedicated playing sheets animate hands and head in Guitar Star. Black-shirt guitar attacks use newly drawn strike and windup poses. Portraits use transparent alpha cutouts and tighter selection framing. Guitar Star basic charge is now 60 simulation frames (one second). See PROMPTS-fixes.md for the full generation prompt log.
