import {test} from 'node:test';
import assert from 'node:assert/strict';
import {characters, registerCharacter} from '../packages/game-core/characters/registry.js';
import {GameSimulation, hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {canSpawnReturningProjectile, spawnReturningProjectile} from '../packages/game-core/simulation/ReturningProjectileSystem.js';
import {hoseFrame, hoseOrigin, hosePose, hoseVisualOrigin} from '../packages/game-core/simulation/HoseAim.js';
import type {CharacterDefinition, ReturningPath} from '../packages/game-core/types.js';

// Unit coverage for the reusable returning-projectile paths, exercised through a
// synthetic fighter so the behavior is proven independent of any shipped roster entry.
const base: ReturningPath = {motion: 'straight', speed: 18, verticalSpeed: 0, gravity: 0, radius: 17, hitInterval: 24, life: 900};
const paths = {
  ...characters.roms.returningPaths,
  straight: base,
  vertical: {...base, motion: 'vertical', speed: 0, verticalSpeed: 20, gravity: 1},
  bounce: {...base, motion: 'bounce', speed: 12, verticalSpeed: 10, gravity: 1},
  solo: {...base, exclusive: true},
  weapon: {...base, weapon: true, life: 400},
  brief: {...base, life: 5},
} satisfies CharacterDefinition['returningPaths'];
const id = 'returning-proof';
function proof(): GameSimulation {
  if (!Object.hasOwn(characters, id)) registerCharacter({...characters.roms, id, returningPaths: paths, returningCapacity: 2});
  // A normal match: training mode regenerates the dummy's health, which would hide damage.
  const game = new GameSimulation([id, 'gut']);
  const [owner, target] = game.state.fighters;
  owner.x = 1200; owner.facing = 1; target.x = 300; target.y = 0;
  game.state.phase = 'fight';
  return game;
}
const active = (g: GameSimulation) => g.state.projectiles.filter(p => p.active && p.owner === 0);
const idle = () => [0, 0] as [number, number];

test('straight paths fly to the arena wall, turn back and are caught by their owner', () => {
  const g = proof();
  spawnReturningProjectile(g.state, 0, 'chop', 'straight');
  const [p] = active(g);
  assert.equal(p.trajectory, 'straight'); assert.equal(p.vx, 18); assert.equal(p.returning, false);
  let turned = 0;
  for (let frame = 0; frame < 400 && p.active; frame++) { g.step(idle()); if (p.returning && !turned) turned = frame; }
  assert.ok(turned > 0, 'projectile should turn back at the wall');
  assert.ok(!p.active, 'projectile should be caught');
  assert.equal(active(g).length, 0);
});

test('vertical paths fall under gravity and return once they drop below the owner', () => {
  const g = proof();
  spawnReturningProjectile(g.state, 0, 'chop', 'vertical');
  const [p] = active(g);
  assert.equal(p.vy, 20);
  let peak = p.y;
  for (let frame = 0; frame < 300 && p.active; frame++) { g.step(idle()); peak = Math.max(peak, p.y); }
  assert.ok(peak > g.state.fighters[0].y + 200, 'projectile should rise well above the owner');
  assert.ok(!p.active, 'falling projectile should be caught');
});

test('bouncing paths rebound from the floor with an impact event and reflect off walls', () => {
  // Launched from mid-arena the ball reaches the floor long before the far wall.
  const g = proof();
  spawnReturningProjectile(g.state, 0, 'chop', 'bounce');
  const [p] = active(g);
  let impacts = 0, reflectedAt = -1, impactAt = -1;
  for (let frame = 0; frame < 600 && p.active; frame++) {
    const vx = p.vx, returning = p.returning;
    g.step(idle());
    const hits = g.gameplayEvents.filter(e => e.type === 'ObjectImpact').length;
    if (hits && impactAt < 0) { impactAt = frame; assert.equal(p.vy, 27, 'floor bounce launches upward'); }
    impacts += hits;
    if (reflectedAt < 0 && !returning && Math.sign(p.vx) !== Math.sign(vx)) reflectedAt = frame;
  }
  assert.ok(impacts > 0, 'floor contact records ObjectImpact');
  assert.ok(reflectedAt > impactAt, 'the far wall reverses horizontal velocity after the first bounce');
  assert.ok(p.returning || !p.active, 'a non-finale ball returns after the wall');
  assert.ok(!p.active);
});

test('exclusive, weapon and capacity rules gate new launches', () => {
  const g = proof();
  assert.ok(canSpawnReturningProjectile(g.state, 0, 'solo'));
  spawnReturningProjectile(g.state, 0, 'chop', 'solo');
  assert.ok(!canSpawnReturningProjectile(g.state, 0, 'solo'), 'exclusive path allows one instance');
  assert.ok(canSpawnReturningProjectile(g.state, 0, 'straight'), 'other paths unaffected by exclusivity');
  spawnReturningProjectile(g.state, 0, 'chop', 'straight');
  assert.ok(!canSpawnReturningProjectile(g.state, 0, 'straight'), 'returningCapacity of two is enforced');
  assert.ok(!canSpawnReturningProjectile(g.state, 0, 'missing'), 'unknown paths never spawn');

  const w = proof();
  assert.equal(w.state.fighters[0].returningWeaponOut, undefined);
  spawnReturningProjectile(w.state, 0, 'chop', 'weapon');
  assert.equal(w.state.fighters[0].returningWeaponOut, true);
  assert.ok(!canSpawnReturningProjectile(w.state, 0, 'weapon'), 'weapon cannot be thrown while away');
  const [p] = active(w);
  for (let frame = 0; frame < 400 && p.active; frame++) w.step(idle());
  assert.equal(w.state.fighters[0].returningWeaponOut, false, 'catching the weapon restores it');
});

test('projectile lifetime expires and the pool slot is recycled', () => {
  const g = proof();
  spawnReturningProjectile(g.state, 0, 'chop', 'brief');
  const [p] = active(g);
  for (let frame = 0; frame < 5; frame++) g.step(idle());
  assert.ok(!p.active, 'five-frame life ends after five ticks');
  spawnReturningProjectile(g.state, 0, 'chop', 'straight');
  assert.equal(active(g).length, 1);
});

test('a target in the flight path is hit once per hit interval and takes move damage', () => {
  const g = proof();
  const [owner, target] = g.state.fighters;
  target.x = owner.x + 220;
  const before = target.health;
  spawnReturningProjectile(g.state, 0, 'chop', 'straight');
  let hitFrame = -1;
  for (let frame = 0; frame < 40 && hitFrame < 0; frame++) {
    g.step(idle());
    if (target.health < before) hitFrame = frame;
  }
  assert.ok(hitFrame >= 0, 'target should be struck');
  const afterFirst = target.health;
  assert.ok(before - afterFirst > 0 && before - afterFirst <= characters.roms.moves.chop.damage, 'a single contact deals at most the launching move damage');
  const p = g.state.projectiles.find(p => p.owner === 0 && p.trajectory === 'straight')!;
  const next = Object.values(p.nextHits ?? {});
  assert.ok(next.some(frame => frame > g.state.frame && frame <= g.state.frame + 24), 'per-target hit interval recorded');
  for (let frame = 0; frame < 20; frame++) g.step(idle());
  assert.equal(target.health, afterFirst, 'no second contact inside the hit interval');
});

test('returning projectiles are rollback safe: restore and replay reproduce the flight', () => {
  const g = proof();
  spawnReturningProjectile(g.state, 0, 'chop', 'bounce');
  for (let frame = 0; frame < 30; frame++) g.step(idle());
  const snapshot = g.snapshot();
  for (let frame = 0; frame < 90; frame++) g.step(idle());
  const expected = hashState(g.state);
  g.restore(snapshot);
  for (let frame = 0; frame < 90; frame++) g.step(idle());
  assert.equal(hashState(g.state), expected);
});

test('hose aiming poses wrap angles and keep the collision origin on authored nozzles', () => {
  assert.equal(hosePose(0), 0); assert.equal(hosePose(360), 0); assert.equal(hosePose(-22.5), 15); assert.equal(hosePose(22.5), 1);
  assert.equal(hoseFrame(0).sheet, 0); assert.equal(hoseFrame(22.5).sheet, 1);
  for (let pose = 0; pose < 16; pose++) assert.equal(hoseFrame(pose * 22.5).cell, Math.floor(pose / 2));
  // Original eight poses remain the collision origin; visual intermediates are cosmetic.
  for (let angle = 0; angle < 360; angle += 45) assert.deepEqual(hoseVisualOrigin(angle), hoseOrigin(angle));
  for (const angle of [22.5, 67.5, 112.5]) assert.notDeepEqual(hoseVisualOrigin(angle), hoseOrigin(angle));
  for (const angle of [0, 90, 180, 270]) for (const value of Object.values(hoseOrigin(angle))) assert.ok(Number.isFinite(value));
});
