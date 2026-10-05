# Movement-controlled facing

Left/right input sets facing; releasing movement preserves it. Opponents crossing sides, knockback, and respawning do not automatically turn a fighter. Attacks start in the selected direction and fixed attack animations retain that direction until they finish. Mobile abilities can turn with movement. Existing jump momentum is unchanged.

Double-tapping either physical direction dashes that way. Blocking remains holding away from an incoming attack, with the existing high/low guard rules. Guard absorbs 60% of damage; the remaining 40% uses existing armor reductions and whole-point rounding. Blocked hits do not apply hit-only status effects or increase the combo count. Chip damage can knock out a fighter outside training.

`tests/facing.test.ts` covers direction changes, neutral input, enemy crossing, same-frame attacks, projectile direction, dash taps, airborne facing, recovery, guard, and deterministic snapshot restoration. The approved control change supersedes the old automatic-facing trace fixture: `movement-facing-baseline.json` records all current moves; `behavior-baseline.json` remains the historical pre-refactor reference.
