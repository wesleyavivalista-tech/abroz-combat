# Elimination modes

Available in Local game types and online room Match mode. Standard supports 2–8 simultaneous players. Party requires exactly six. Each fight restores three lives, health, energy, and move/ultimate availability. Player seats, fighter and skin choices, and input frame numbers persist. Six-second breaks separate fights. Draws replay the same group.

## Standard

Each FFA winner is saved and sits out subsequent fights in that round. The last unsaved player is eliminated. Saved players return to start the next round. The final two play one deciding duel.

## Party

- Six: seeded random 3v3. Winning team is saved, losing trio plays FFA. Its winner is saved and remaining pair duels; loser leaves.
- Five: FFA stops at the first final-life loss. That player leaves. Simultaneous final-life losses trigger a deciding elimination challenge among only the tied players; others are saved.
- Four: seeded random 2v2. Losing teammates duel and the loser leaves.
- Three: standard winner-saved FFA followed by the unsaved players' duel.
- Two: final duel crowns the champion.

A disconnect eliminates that seat even if saved; all connected survivors advance to a fresh round appropriate for their remaining count. This can skip a format when several people leave. The last connected player wins by forfeit; everyone leaving ends without a champion.

## Controls and online

Local P1/P2 retain their keyboard controls. P3 onward use controllers 1 onward, with persistent seats even while sitting out. Local setup checks required controllers are connected. Online players each use their normal P1 controls, including while their seat is safe/eliminated (inputs still advance synchronization).

Room server distributes one seed to all clients. The shuffled teams, remaining/saved/active/eliminated seats, stage, pending fight, and random state are included in rollback snapshots. No wall-clock/random calls enter simulation. Protocol version 41 prevents older clients from starting incompatible rooms.

Tests cover full standard and Party competitions, ties, final-life detection, safe/active withdrawals, team allocation, snapshots, rollback, and room startup.
