# Gut spear and meditation update

- Removed range-driven sliding of the spear through his hands. The weapon has a fixed grip and fixed length; the attack artwork extends his arms.
- Spear mode expiry throws one spear in the facing direction. It travels across the arena, deals 140 damage on an unblocked hit, and disappears on the first opposing fighter or clone contact. Allies are ignored. Defeat does not spawn a throw.
- Meditation heals 55 HP (5% of maximum health) every 120 simulation ticks / 2 seconds while held, capped at maximum health. A bright green ring and five rising healing crosses replace the generic impact burst.
- Protocol version 19 keeps online clients and servers on the same rules.

Validation: 163 tests pass, including both throw directions, arena reach, single-hit stopping, allies, blocking, death, deterministic replay, fixed spear grip and healing cadence. Production build passes.
