export interface Entrant { id: number; name: string; character: string; skin: string; withdrawn?: boolean }
export interface BracketMatch {
  id: string; round: number; slots: [number | null, number | null];
  status: 'pending' | 'ready' | 'playing' | 'complete';
  winner: number | null; reason?: 'played' | 'bye' | 'forfeit'; attempt: number;
}
export interface Championship {
  entrants: Entrant[]; rounds: BracketMatch[][]; round: number; complete: boolean; champion: number | null;
}
/** Registration order is seeding order. Standard mirrored seeds spread first-round byes. */
export function createChampionship(entrants: Entrant[]): Championship {
  if (entrants.length < 2 || entrants.length > 16 || new Set(entrants.map(e => e.id)).size !== entrants.length)
    throw new Error('Choose 2–16 distinct entrants');
  let seeds = [1, 2];
  while (seeds.length < entrants.length) { const size = seeds.length * 2 + 1; seeds = seeds.flatMap(n => [n, size - n]); }
  const rounds: BracketMatch[][] = [];
  for (let count = seeds.length / 2, r = 0; count >= 1; count /= 2, r++) {
    rounds.push(Array.from({ length: count }, (_, i) => ({ id: `${r}-${i}`, round: r,
      slots: r === 0 ? [entrants[seeds[i * 2] - 1]?.id ?? null, entrants[seeds[i * 2 + 1] - 1]?.id ?? null] : [null, null],
      status: 'pending', winner: null, attempt: 0 })));
  }
  const bracket: Championship = { entrants: entrants.map(e => ({ ...e })), rounds, round: 0, complete: false, champion: null };
  advanceBracket(bracket);
  return bracket;
}
export function currentMatches(b: Championship): BracketMatch[] { return b.complete ? [] : b.rounds[b.round]; }
export function findMatch(b: Championship, id: string): BracketMatch | undefined { return b.rounds.flat().find(m => m.id === id); }
export function matchToken(m: BracketMatch): string { return `${m.id}:${m.attempt}`; }
export function startBracketMatch(b: Championship, id: string): BracketMatch {
  const m = findMatch(b, id);
  if (!m || m.round !== b.round || m.status !== 'ready' || b.complete) throw new Error('Match is not ready');
  m.status = 'playing'; return m;
}
export function finishBracketMatch(b: Championship, id: string, winner: number | null): void {
  const m = findMatch(b, id);
  if (!m || m.status !== 'playing' || m.round !== b.round) throw new Error('Match is not playing');
  if (winner === null) { m.status = 'ready'; m.attempt++; return; } // A draw replays the same duel.
  if (!m.slots.includes(winner)) throw new Error('Winner must belong to this match');
  m.winner = winner; m.reason = 'played'; m.status = 'complete'; advanceBracket(b);
}
export function withdrawEntrant(b: Championship, id: number): void {
  const entrant = b.entrants.find(e => e.id === id);
  if (!entrant || b.complete) return;
  entrant.withdrawn = true; advanceBracket(b);
}
function advanceBracket(b: Championship): void {
  while (!b.complete) {
    const round = b.rounds[b.round];
    for (const m of round) {
      if (m.status === 'complete') continue;
      const eligible = m.slots.filter((id): id is number => id !== null && !b.entrants.find(e => e.id === id)!.withdrawn);
      if (eligible.length < 2) {
        m.winner = eligible[0] ?? null; m.status = 'complete';
        m.reason = m.slots.includes(null) ? 'bye' : 'forfeit';
      } else if (m.status === 'pending') m.status = 'ready';
    }
    b.rounds[b.round + 1]?.forEach((m, i) => { m.slots = [round[i * 2].winner, round[i * 2 + 1].winner]; });
    if (round.some(m => m.status !== 'complete')) return;
    if (b.round === b.rounds.length - 1) { b.complete = true; b.champion = round[0].winner; return; }
    b.round++;
    b.rounds[b.round].forEach((m, i) => { m.slots = [round[i * 2].winner, round[i * 2 + 1].winner]; });
  }
}
export function roundName(b: Championship, round: number): string {
  return ['Final', 'Semifinals', 'Quarterfinals', 'Round of 16'][b.rounds.length - 1 - round];
}
