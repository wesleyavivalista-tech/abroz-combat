# Eide

Appearance approved on 2026-10-01. Height: 1.76 m. Navy work outfit with messenger bag and badge; tan gym outfit with cap and tattoos. Approved portraits remain unchanged.

## Controls and rules

- Basic 1: lead punch → cross → hook (48 / 58 / 82 base damage).
- Basic 2: heavy kick (115); Basic 3: heavy punch (100).
- Seller: 25 energy, straight projectile, 85 base damage and knockback.
- Casas Bahia: 25 energy, upward arc, 100 base damage, knockback and knockdown.
- Both throws select independently from washing machine, sofa, TV, laptop, refrigerator, microwave, office chair, vacuum cleaner, fan and coffee machine. Selection is stored in simulation snapshots so rollback reproduces the same object. The held object matches the projectile.
- In love: full energy, once per match. Two visually different blondes enter from opposite arena edges, walk toward the outer platforms, hop up and walk to their positions, then stay there. Each has 500 HP. Eide takes 20% less damage, moves 40% faster, deals 50% more damage and dashes 3× farther until both are defeated. They have walking, jump, idle, hit and defeat sprites and cannot attack. Allied attacks do not damage them. Heart eyes, tongue-out smile and floating hearts provide the nonsexual visual treatment.
- Suco lover: full energy, once per match. A 90-frame injection sequence precedes 1,200 simulation frames (20 seconds) of mutant form. Speed is 60% of normal and damage is 180%. Basic 1 Giant Punch, Basic 2 Charge, Basic 3 Flying Kick. No other attacks during this form. Love bonuses pause while mutant; surviving blondes restore Love Mode afterward.
- Losing a life removes Eide's summons and Love bonuses, following the game's existing transformation cleanup.

## Art and review

All production art lives in `apps/client/public/art/eide/`. Files ending `-clean` remove background haze; source generations are retained. Opposite-foot frames explicitly alternate the foreground and background legs. Mounted poses use the final column of each skin in `forms.png`.

- `/eide-preview.html`: interactive combat review, both skins, movement, attacks, transformations and NPC reactions.
- `/fighter-lineup.html`: both skins, Love Mode, mutant, blonde companion and mounted poses at shared game scale.
- `/art/reviews/eide-v1/index.html`: approved appearance reference.
- `production-prompts.json`: initial generation prompts and tool provenance.
- `blonde-v2-prompts.json`: distinct blonde designs and entrance sprite prompts.

## Validation

Automated tests cover the ten-object selection, trajectory and impacts, summon entrance paths, hit-paused movement, stationary arrival, 500 HP, exact modifiers, dash multiplier, NPC immunity to allied damage and knockback, defeat cleanup, mutant duration and attacks, six simultaneous Eides, and deterministic snapshot replay. Full suite: 551 passing tests. Typecheck, lint and client/server builds pass. Browser checks cover actual in-arena render and asset loading; no separate two-device online play session was run.
