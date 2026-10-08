import type {SimulationSnapshot, StageDefinition} from '../types.js';
import {actors} from '../simulation/Actors.js';

/** Integer tick triangle wave: identical on clients, authority and rollback. */
export function platformX(p: NonNullable<StageDefinition['platforms']>[number], tick: number): number {
  if (!p.motion) return p.x;
  const {from, to, period, phase = 0} = p.motion;
  const t = ((tick + phase) % period + period) % period;
  return from + (to - from) * (t <= period / 2 ? t : period - t) / (period / 2);
}
export function stageAtTick(stage: StageDefinition, tick: number): StageDefinition {
  if (!stage.platforms?.some(p => p.motion)) return stage;
  return {...stage, platforms: stage.platforms.map(p => ({...p, x: platformX(p, tick)}))};
}

const surfaceKinds = new Set(['honey','fire-trail','blood-pool','blood-trail','snot','cookie-crumbs','origami','spider']);

/** Carry supported actors and surface-bound abilities before their own movement. */
export function advancePlatforms(s: SimulationSnapshot, stage: StageDefinition): void {
  if (!stage.platforms?.some(p => p.motion) || s.hitstop || s.phase !== 'fight') return;
  const tick = s.platformTick ?? 0;
  const old = stageAtTick(stage, tick).platforms!;
  const next = stageAtTick(stage, tick + 1).platforms!;
  const support = (x: number, y: number, margin = 0) => old.findIndex(p => p.motion && p.y === y && x >= p.x - margin && x <= p.x + p.width + margin);
  const delta = (i: number) => i < 0 ? 0 : next[i].x - old[i].x;
  const structures = s.structures ?? [];
  const structureDelta = new Map(structures.map(b => [b.id, delta(support(b.x, b.y))]));
  for (const {fighter: f} of actors(s)) {
    if (f.undead==='grave' || f.vy !== 0 || f.npcEntrance || f.lives <= 0 || f.respawnAt) continue;
    let dx = delta(support(f.x, f.y));
    // Fighters standing on a constructed wall ride its supporting platform too.
    const roof = structures.find(b => b.phase === 'built' && b.kind !== 'turret' && f.y === b.y + b.height && Math.abs(f.x - b.x) <= b.width / 2);
    if (roof) dx = structureDelta.get(roof.id) ?? 0;
    f.x = Math.max(40, Math.min(stage.width - 40, f.x + dx));
  }
  for (const b of structures) b.x += structureDelta.get(b.id) ?? 0;
  for (const h of s.hazards) if (!h.kind || surfaceKinds.has(h.kind)) h.x += delta(support(h.x, h.y, 24));
  s.platformTick = tick + 1;
}
