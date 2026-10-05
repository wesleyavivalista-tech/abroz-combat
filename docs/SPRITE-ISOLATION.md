# Sprite edge cleanup

Bozo and Tocha's pose rectangles sometimes included pixels from neighboring poses on their shared animation sheets. Tightening those rectangles would also cut off hands, feet, flames, or extended beard attacks.

The renderer now labels connected artwork by its owning pose and discards neighboring artwork when drawing a frame. Masks are cached per sheet and pose selection is independent per fighter, including mirror matches and hair clones. Existing frame sizes, pivots, and animation timing remain unchanged.

The source-alpha audit covered 144 poses across eight sheets and identified contamination in 20 crops: six on Tocha's first base sheet, one on his second, four on Bozo's first sheet, six on his second, and three on the clone sheet. Tocha's two fire sheets and breathing sheet were clean. Detailed pixel counts are in `sprite-isolation-audit.json`.

Validation: 128 tests, TypeScript, lint, and production build passed. In-game checks confirmed clean Tocha jump and Bozo heavy-beard silhouettes without browser errors. Regression tests cover crossing limbs, neighboring crops, detached flames, and transparent padding.
