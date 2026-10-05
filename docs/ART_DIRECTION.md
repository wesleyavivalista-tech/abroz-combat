# Painted Foundry art pass

Original backdrop generated with the built-in image-generation tool. Asset: `apps/client/public/art/foundry-painted.png`. No reference artwork or existing game assets were used.

## Generation prompt

Use case: stylized-concept. Asset type: original wide background matte painting for a side-view 2.5D fighting game called Afterglow, no text in image. An abandoned subterranean industrial foundry converted to a combat arena. Monumental layered architecture, tall arched factory windows in the upper rear wall, immense circular turbine recessed in the central rear wall, overhead pipes and gantry walkways, warm amber furnace light from the right, cool teal atmospheric light from the left, dusty shafts of light, hints of vegetation invading steelwork, rich graphic-novel ink outlines and painterly cel-shaded brush textures. Beautiful cinematic hand-painted game environment, dramatic but serene. Composition very wide landscape 16:9: central lower third kept uncluttered and dark as negative space behind playable fighters; background ends in a low straight horizontal platform edge near the bottom; camera square-on side view with mild perspective depth, no steep overhead view. Layers of foreground side framing, midground machinery and hazy far background. Palette deep midnight teal, aged jade metal, muted brass and amber, tiny lime accent lights. Crisp illustrated forms, painterly weathering, carefully composed light and shadow. NO people, NO fighters, NO characters, NO text, NO logos, NO interface, NO watermark. Entirely original, not based on any existing game.

## Integration

The illustration is a rear stage layer. Physical floor, fighter rigs, shadows, atmosphere and particles remain rendered in Three.js. Combat simulation and frame timings remain authoritative and independent of art.

## Dark arcade UI
The user-provided fighting-game selection reference informed the large face-off portraits, thumbnail roster, dark panels and warm gold accents. The two new SVG portraits are original code-authored artwork for Vector and Brut. The reference image is not bundled.

## Detailed portrait and material pass
The menu now uses original generated painted portraits with layered armor, worn metal, exposed joints and cinematic lighting. Files: `apps/client/public/art/prototype-a-portrait-v2.png` and `prototype-b-portrait-v2.png`. Generated with the built-in image tool; exact prompts are recorded in `ART_PROMPTS_V2.md`. Original SVGs remain available as earlier artwork.

Arena fighters retain their articulated animation rig, now with physically lit metal materials, procedural surface wear, layered chest plating, cooling slots, fasteners, jaw panels, mechanical joints and armored knuckles. Brut has heavier shoulder/gauntlet proportions; Vector has a helmet fin. These are visual changes only; combat boxes and timings are unchanged.


## Abroz custom wordmark
`apps/client/public/art/abroz-combat-wordmark.svg` is original hand-authored vector lettering. Both words use custom paths, with angular counters, an uneven red painted strike, restrained wear, and a cream underline. The home headline uses the SVG with accessible alt text. Verified in the browser against the rooftop scene. Production build passes.


The active wordmark is now `apps/client/public/art/abroz-combat-wordmark-v2.svg`: original silhouette preserved, with rough ink edges, letter scuffs, warm paint shading, spray flecks and a swept two-color brush underline. V1 retained. Verified the logo on the home screen and P2 name next to its right-hand HUD portrait in training; build passes.
