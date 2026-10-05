# Biel

Approved look: gray tee portrait identity retained for the gray suit portrait; both approved full-body models use the Gut sprite style. Height 1.76m. Original skin: gray suit and open white shirt. Casual skin: gray tee, charcoal trousers, forearm tattoo.

## Gameplay

- Combo: punch, punch, kick. Basic 2 heavy kick; Basic 3 heavy punch.
- Wine lover: 25 energy, 65 base damage; unblocked bottle contact slows movement 20% for 120 ticks.
- Coin Rain: 25 energy; 36-tick bag flight and burst, followed by a 320-unit area for 300 ticks, 8 damage per 12-tick pulse. Hold toward/away during startup to choose far/near placement; neutral selects middle distance. Teammates are immune.
- Selling Loan: full bar, once per match. Every basic button becomes the LOAN stamp. Five attempts; block consumes an attempt without applying the effect. First successful contact ends stamp mode and applies 120-tick stun, 1,800-tick energy gain/ability lock, then another 120-tick stun. Energy lock also covers training refill and ultimate reactivation. Normal basic attacks remain available to a debtor after the first stun.
- MMORPG addicted: full bar, once per match; 150-tick interruptible computer/spending startup, followed by 1,500 ticks of flight. All four directions steer except while channeling Divine Energy Beam (including its startup and recovery); hit reactions prevent steering but retain flight. Basic 1 sends five feathers downward (22 damage each); Basic 2 dives with a 140-damage sword strike; held Basic 3 sustains a 12-damage beam every 8 ticks. Release ends the beam.
- Natural angel expiry restores Biel and drops five deterministic money pickups for ten seconds. Allies gain 15 energy; enemies receive 20% movement slow for two seconds. Knockout removes the form without spawning expiry pickups.

Unspecified damage, costs, flight speed and pickup amounts are initial balance values. User-specified durations and slow strength are preserved. All timers use the 60 Hz simulation clock, including through hitstop. Snapshot fields replay through rollback; there are no gameplay wall-clock timers or random calls.

## Art and presentation

`public/art/biel/` contains approved masked menu portraits, 24 combat poses per skin, eight ultimate poses per skin, 12 angel poses, seated knight poses, a dedicated victory portrait and walking sources. Walking plays a six-phase loop using near-leg contact/plant, separately authored opposite-leg contact/recovery, near-leg pass, and near-leg extension. A corrected opposite-leg sheet keeps the casual shirt light gray throughout. Both legs alternate; each frame keeps a fixed anatomical height and hip anchor. The duplicate half-cycle of the initial generated walking sheets is unused.

Loan mode adds dedicated walking, jump, fall, landing, dash and crouch poses for both skins. Coin Rain uses a three-pose throw, a bag that travels from the release point and bursts overhead, and gold hit flashes keyed to actual damage. Built-in imagegen prompts for these assets are saved in `public/art/biel/movement-fixes-prompts.json`.

`BielRenderer` owns skin/mode action mapping and validates the animation manifest and atlas bounds. `FinanceEffects` renders pooled wine, feather, coin, bill, beam and transformation visuals; coin particles have a shared budget. The beam uses the same ray as gameplay damage. Loan, remaining stamps and transformation time appear above fighters. Energy UI indicates the Loan lock.

Preview: `/biel-preview.html`, with each move, both skins, pause and single-frame stepping. Production fighter selection, field guide, training, local and online roster all include Biel.

## Verification

Dedicated tests cover projectile slow, teams and area duration, five attempts, blocked/successful stamp, single-target Loan, both stuns, energy denial, interrupted startup, flight recovery after hitstun, held beam release, natural expiry pickups, knockout/reset cleanup and snapshot replay. Full repository checks and client/server builds are required after gameplay changes. Gameplay revision and room server must stay synchronized.
