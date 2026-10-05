# Animation improvements

All three fighters and both skins use new anticipation/recoil poses for their basic attacks. Existing impact artwork and combat timing are preserved. Tocha uses six guarded walk frames. Bozo retains the existing six-frame walk artwork with continuous weight transfer. Clones alternate four new steps with the original four, giving eight walk phases. Gut and clones gain grounded back-dash loading/settling poses. Small rigid weight shifts apply to attacks, dashes, hit reactions and walking without resizing bodies.

Gut spear mode now has anticipation and recovery, with a fixed grip on a rigid 4.3-unit shaft. Reach comes from the illustrated arm extension; the shaft no longer slides through his hands. Its angle remains tied to both hands. No weapon scaling or deformation is used.

The generated sheets contain unused candidate frames; only reviewed matching poses are used. New ownership masks are prepared during loading to avoid a first-use animation hitch. All animation phases use simulation ticks, preserving pause, hit-stop and rollback behavior.

## Saved artwork

- [Tocha](../apps/client/public/art/tocha/motion-expansion-v1.png)
- [Bozo](../apps/client/public/art/bozo/motion-expansion-v1.png)
- [Hair clones](../apps/client/public/art/bozo/clone-expansion-v1.png)
- [Gut](../apps/client/public/art/gut/motion-expansion-v1.png)

Generated with the built-in imagegen tool. [Exact prompts](animation-expansion-prompts.json).

## Validation

159 tests pass, including new checks for basic attack phases, grounded six-pose Tocha walks in both skins/directions, clone in-betweens, frozen simulation-time animation, and fixed spear geometry across attack phases. Browser comparison checked original and alternate skins, walk poses, attack poses and back dashes. Production build passes.
