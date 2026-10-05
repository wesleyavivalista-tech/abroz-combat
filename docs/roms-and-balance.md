# Roms and balance update — 25 September 2026

Roms appearance approved: firefighter portrait v2, hoodie portrait v5, model v2. Six-fighter roster now includes both Roms skins, axe combo, heavy chop, vertical returning axe, five-second 40% armor, three-second movable spin, 25-second juggling and five-second finale, and a 15-second aimed water stream. Movement, combat, protective gear, juggling, return/catch and victory art are stored under `apps/client/public/art/roms`.

Caio: Sea of blood lasts 25 seconds and slows opponent movement and attacks by 90%. Its caster gains 20% movement speed while below his flood surface. Poison dart keeps its 45 direct damage and applies a four-second 20% movement slow plus eight ticks of 10 damage at half-second intervals. Armor applies to each poison tick; refreshes do not stack or postpone ticks. The visible poison aura ends with the effect.

Drupa (Andrei): heavy belly bump knockback raised from 38 to 60.8, a 60% increase.

Protocol version 32. Type checking, lint, all 223 tests and production build pass. Tests cover effect durations, poison refresh/expiry, flood entry/exit, Roms projectile return/exclusivity, armor, spin, water knockback and snapshot replay.
