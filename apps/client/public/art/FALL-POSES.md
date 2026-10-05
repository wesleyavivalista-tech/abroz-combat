# Neutral descent frames

Generated with the built-in image-generation tool using existing fighter sprite references. Exact prompts: `fall-poses-prompts.json` and `fall-form-prompts.json`.

Each `fall-v1.png` contains two columns: standing height reference, neutral descent. Rows follow first skin, second skin, then transformed form where applicable. Gut spear, Drupa Buda and Caio sunglasses/master forms have separate sheets. Astolfo retains the distinct fall frames already authored in `movement-v2.png`.

`FallVisual` replaces only body objects during neutral `Fall`, preserving base effects, facing, elevation and shadows. Attacks, hit reactions, landing and all other states restore the original renderer. Standing reference height calibrates each row. Shared derived textures are disposed with fighter assets.

Preview: `/fighter-lineup.html`, Pose → Fall.
