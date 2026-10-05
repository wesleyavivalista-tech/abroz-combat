# Dodo — appearance review

Status: APPROVED by the user on September 25, 2026. Approved portraits and static models are frozen in approved/; manifest.json records the authoritative skin order and source files. Earlier revision notes are historical.

Height: 1.82 m. Always holding his guitar: use the reference white single-cut electric guitar with black pickguard. Short salt-and-pepper hair, full dark beard, broad face and natural average-to-solid build, moderately broad shoulders, soft straight waist and slight belly, ordinary arms and relatively long legs. Initial art uses the no-glasses face references.

- Skin 1: black T-shirt, light beige knee-length shorts from the latest full-body photo, All Star sneakers.
- Skin 2: dark short-sleeved collared button-up shirt with olive/yellow-green leaf print, black knee-length shorts, All Star sneakers.
- Menu: combat-ready pose, matching roster lighting and visual style.
- Model: full-body right-facing combat stance, clear separate legs and feet.
- Once approved: walking must alternate both legs with convincing weight transfer.

## Gameplay brief reserved for after approval

Basics: punch → kick → guitar swing; heavy guitar swing; kick.

Power Chord: mid-range frontal soundwave, damage and backward knockback.

Low-profile: show LOW-PROFILE for 2 seconds at activation; immediate complete invisibility for 5 seconds. Movement, jump, dash and attacks stay available without revealing Dodo. Suppress all position-revealing visuals, including jump/dash trails and particles. Return to visibility automatically. Resolve the text placement versus total invisibility requirement during implementation.

Pain Killers: summon three distinct basketball players (one white, one Black, one Asian man), each with approximately 40% of Dodo's max health and their own health bar. Each has a quick three-punch combo and a damaging basketball throw. Use the supplied black/burgundy chevron PAINKILLERS uniform, with distinct numbers and appearances. Duration and other unspecified values remain to be defined during implementation.

Guitar Star: 20-second music mode. Continual mid-range soundwaves in all directions damage and knock back nearby opponents. Replace basics with a frontal long-range heavy soundwave requiring a held 2-second charge. Return to normal moveset on expiry.

Reference folder: /Users/nicol/Desktop/Abroz fight/Dodo

## Revision 2

User rejected the initial likeness, especially the body. Use the wedding and full-body standing photos to anchor the proportions. Avoid exaggerated muscles and a squat torso. Both skins need a serious combat-ready expression and a guitar guard ready to strike, rather than a playing pose. All four appearance assets are regenerated; approval is still pending.

## Latest direction (supersedes revision 2)

Original fighter models were fine. Preserve their identity and poses; only edit skin 1 clothing to the new beige shorts. Redo the two MENU portraits with natural proportions based on Screenshot 2026-09-25 at 17.03.28.png. Alert, combat-ready stance, guitar held naturally across waist, never brandished as a bat. Skin 2 now uses the latest reference outfit: leaf-print short-sleeved shirt and black shorts.

## Portrait revision 4

User clarified that the upper body should be larger. Widen and fill out chest, shoulders, upper arms and torso; restore the braced, knees-bent readiness of the first portraits. Preserve current shorts outfits, natural guitar hold and original fighter models. Appearance approval is still pending.

## Final clarification for current revision

The user meant LONGER torso, not wider. Revision 4 widening instruction is superseded. Menu portraits must be close head-to-knees crops like the other fighters, not zoomed-out full-body pictures. Keep current outfits, natural guitar hold, combat readiness, and unchanged fighter models.

## Approved skin 2 likeness

User likes menu-skin-2-leaf.png and requests only more combat readiness. Preserve its face, proportions and outfit. Pose should be braced and expression focused while the guitar stays naturally at the waist. Keep the closer head-to-knees menu crop requested previously.

## Current portrait pose: guitar on back

User requests guitar strapped across the back and both hands raised ready to fight. This supersedes the requirement to hold the guitar in menu portraits only. Retain current black-shirt/beige-shorts and leaf-shirt/black-shorts outfits, close head-to-knees framing and likeness. Full-body fighter models still hold the guitar and stay unchanged.


## Fresh portraits v8
Both menu portraits regenerated from real photo references, without generated Dodo input images. Guitar on back, empty hands in fighting guard, close head-to-knees framing. Existing fighter models retained. Built-in image generation; prompts in PROMPTS-fresh-v8.md.


## Matched portraits v9
Selected leaf-shirt portrait retained as the common base. Guitar moved upright for consistent neck/body alignment; black T-shirt and beige shorts applied as a clothing variant. Models unchanged.


## Current skin order and portraits v11
Skin 1: leaf-print shirt and black shorts. Skin 2: black T-shirt and beige shorts. This supersedes earlier numbering. Portraits rerendered using real face references to reduce patterned skin artifacts. Fighter model artwork unchanged and reordered alongside matching portraits.


## Appearance approved — September 25, 2026
Authoritative final assets: approved/skin-1-menu.png and approved/skin-1-model.png (leaf-print shirt, black shorts); approved/skin-2-menu.png and approved/skin-2-model.png (black T-shirt, beige shorts). Keep these approved appearances as the basis for implementation. Gameplay and animation implementation is the next phase.


## Playable implementation — September 25
Dodo is implemented in the roster with both approved skins, authored animation sheets, Power Chord, five-second Low-profile, three 400-health Pain Killers, and twenty-second Guitar Star with two-second charged waves. The LOW-PROFILE notice stays in the HUD. Companions remain until defeated or their owner loses a life. Automated regression tests and a production build pass.
