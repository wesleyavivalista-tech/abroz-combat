# Bozo: grip duration and Body Hair reach

- Hair Grip: 180 simulation ticks (3 seconds), previously 120.
- Body Hair: outer reach 1306 units, previously 653. Inner offset remains 15; damage, cost and animation timing are unchanged.
- New transparent artwork: `apps/client/public/art/bozo/body-hair-long-v1.png`. Original art is preserved.
- The renderer reveals a fixed-scale portion of the new full-length artwork while retaining its tip. Horizontal and vertical pixel density stay equal throughout extension/retraction; the fighter is not stretched. A short alpha overlap blends the root into the existing pose.
- The asset is preloaded for both skins and hair clones through VisualRegistry.

Validation: 1,589 tests pass, TypeScript and targeted renderer lint pass, web build succeeds. Tests cover 180-tick release, doubled reach in both facings, rollback, fixed pixel density, transparent art dimensions and body pose preservation. Only the expected `bozo:grip` movement trace changed. Browser review checked full extension, partial extension and armored retraction with no shader errors. The renderer review exercised 14,316 pose updates across both skins, armor and clones.

Changes are local; no production deployment or new packaged desktop build was performed for this update.
