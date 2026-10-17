import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GameSimulation, hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {RollbackManager} from '../packages/networking/RollbackManager.js';
import {StateHistory} from '../packages/networking/StateHistory.js';
import {encodeSnapshot, type RecoveryState} from '../packages/shared/recovery.js';
import {Button} from '../packages/game-core/types.js';

// Unit coverage for the rollback layer's guard rails: seat validation, the peer
// gate, history limits, departures, hash verification, confirmed impact delivery
// and resumption from a recovery checkpoint.
function manager(seat = 0, fighters = ['gut', 'tocha'], delay = 2, horizon = 8) {
  const simulation = new GameSimulation(fighters);
  simulation.state.phase = 'fight';
  return new RollbackManager(simulation, seat, delay, horizon);
}
/** Deliver every remote input immediately so frames confirm as they are played. */
function playConfirmed(m: RollbackManager, frames: number, local = 0, remote = 0): void {
  for (let i = 0; i < frames; i++) {
    m.schedule(local, () => {});
    const target = m.simulation.state.frame + m.inputDelay;
    m.simulation.state.fighters.forEach((_, seat) => { if (seat !== m.seat) m.receive(target, remote, seat); });
    assert.ok(m.tick(), `frame ${m.simulation.state.frame} should not stall`);
  }
}

test('seats are validated and the two-player accessors address the other peer', () => {
  assert.throws(() => manager(2), /Invalid player seat/);
  assert.throws(() => manager(-1), /Invalid player seat/);
  assert.throws(() => manager(1.5), /Invalid player seat/);
  const host = manager(0), guest = manager(1);
  assert.equal(host.remote, host.remotes[1]); assert.equal(host.used, host.usedBySeat[1]);
  assert.equal(guest.remote, guest.remotes[0]); assert.equal(guest.used, guest.usedBySeat[0]);
  assert.equal(host.confirmed, 1); assert.equal(host.remoteFrame, 1);
});

test('the countdown waits for every connected peer to deliver its first real input', () => {
  const m = manager(0, ['gut', 'tocha', 'roms']);
  assert.ok(m.waitingForPeers);
  m.receive(m.inputDelay, 0, 1);
  assert.ok(m.waitingForPeers, 'still waiting for seat 2');
  m.disconnect(2, 0);
  assert.ok(!m.waitingForPeers, 'departed peers never block the start');
  m.tick();
  assert.ok(!m.waitingForPeers, 'the gate only applies at frame zero');
});

test('prediction stalls at the horizon and resumes once remote input arrives', () => {
  const m = manager();
  for (let i = 0; i < 20 && m.tick(); i++) m.schedule(0, () => {});
  assert.ok(m.stalled);
  assert.equal(m.simulation.state.frame, m.confirmed + m.maxRollbackFrames + 1);
  const stalledAt = m.simulation.state.frame;
  for (let f = 0; f < stalledAt + 2; f++) m.receive(f, 0);
  assert.ok(m.tick());
  assert.ok(!m.stalled);
  assert.equal(m.simulation.state.frame, stalledAt + 1);
});

test('late input older than retained history is a terminal desync', () => {
  const m = manager(0, ['gut', 'tocha'], 2, 10_000);
  for (let i = 0; i < 200; i++) { m.schedule(0, () => {}); m.tick(); }
  m.receive(5, Button.Right);
  assert.equal(m.desync, 'Input outside history');
  assert.ok(!m.tick(), 'a desynced match no longer advances');
  let sent = 0; m.schedule(Button.Light, () => { sent++; });
  assert.equal(sent, 0, 'no further inputs are sent after desync');
});

test('a departure in the past rolls back, replays with neutral input and ignores later packets', () => {
  const m = manager();
  playConfirmed(m, 30, 0, Button.Right);
  const before = m.rollbackCount;
  m.disconnect(1, 20);
  assert.equal(m.rollbackCount, before + 1);
  assert.equal(m.rollbackFrames, 10);
  assert.equal(m.prediction(25), 0, 'departed seats predict neutral');
  assert.equal(m.prediction(19), Button.Right, 'inputs before departure remain');
  m.receive(28, Button.Light);
  assert.equal(m.remotes[1].get(28), Button.Right, 'inputs after the departure frame are dropped');
  assert.equal(m.usedBySeat[1].get(25), 0, 'replayed frames after departure used neutral input');
  m.disconnect(1, 10);
  assert.equal(m.departures.get(1), 20, 'a departure is recorded once');
  m.disconnect(0, 10);
  assert.ok(!m.departures.has(0), 'the local seat never departs');
  assert.equal(m.desync, 'OK');
});

test('a mismatched remote hash on a settled frame is terminal; unsettled frames are undecided', () => {
  const m = manager();
  playConfirmed(m, 65);
  assert.equal(m.verifyRemoteHash(200, 'abc'), undefined);
  const settled = m.confirmedHash(60);
  assert.ok(settled);
  assert.equal(m.verifyRemoteHash(60, settled), true);
  assert.ok(m.isHashFrameRetained(60));
  assert.ok(!m.isHashFrameRetained(-1)); assert.ok(!m.isHashFrameRetained(1.5)); assert.ok(!m.isHashFrameRetained(m.simulation.state.frame + 100));
  assert.equal(m.verifyRemoteHash(60, 'deadbeef'), false);
  assert.match(m.desync, /^MISMATCH @ 60$/);
  assert.equal(m.verifyRemoteHash(60, settled), false, 'nothing verifies after a desync');
});

/** Predict a jab while all remote inputs after bootstrap are still missing. */
function predictedJab() {
  const m = manager(0, ['gut', 'tocha'], 2, 60);
  const [a, b] = m.simulation.state.fighters;
  b.x = a.x + 90;
  const health = b.health;
  for (let frame = 0; frame < 25; frame++) {
    m.schedule(frame === 8 ? Button.Light : 0, () => {});
    assert.ok(m.tick());
  }
  assert.equal(m.confirmed, 1, 'remote inputs remain unconfirmed');
  assert.ok(m.simulation.state.fighters[1].health < health, 'prediction landed a real hit');
  return {m, health};
}

test('predicted damage impacts wait for confirmation and are delivered exactly once', () => {
  const {m} = predictedJab();
  assert.deepEqual(m.drainConfirmedImpacts(), [], 'unconfirmed damage must not be presented');
  for (let frame = 2; frame < 27; frame++) m.receive(frame, 0);
  const delivered = m.drainConfirmedImpacts();
  assert.equal(delivered.length, 1, 'the confirmed jab is delivered once');
  assert.equal(delivered[0].type, 'DamageApplied');
  assert.deepEqual(m.drainConfirmedImpacts(), []);
  playConfirmed(m, 10);
  assert.deepEqual(m.drainConfirmedImpacts(), [], 'later frames cannot redeliver the jab');
});

test('rollback discards a predicted damage impact when late input avoids the hit', () => {
  const {m, health} = predictedJab();
  assert.deepEqual(m.drainConfirmedImpacts(), []);
  // The opponent jumped before the jab, but that input arrived after prediction.
  for (let frame = 2; frame < 27; frame++) m.receive(frame, frame === 2 ? Button.Up : 0);
  assert.ok(m.rollbackCount > 0, 'the correction actually replayed the match');
  assert.equal(m.simulation.state.fighters[1].health, health, 'the corrected jump avoids damage');
  assert.equal(m.desync, 'OK');
  assert.deepEqual(m.drainConfirmedImpacts(), [], 'the invalidated hit is never presented');
  playConfirmed(m, 10);
  assert.deepEqual(m.drainConfirmedImpacts(), []);
});

test('restoreRecovery resumes mid-match and fills the input gap up to the resumed frame', () => {
  const source = manager();
  playConfirmed(source, 40, Button.Right, Button.Left);
  const snapshot = source.simulation.snapshot();
  const state: RecoveryState = {
    snapshot: encodeSnapshot(snapshot),
    inputs: [[...source.local].filter(([f]) => f < snapshot.frame), [...source.remotes[1]].filter(([f]) => f < snapshot.frame)],
    departures: [],
    nextInput: snapshot.frame,
  };
  const resumed = manager();
  resumed.restoreRecovery(state);
  assert.equal(resumed.simulation.state.frame, snapshot.frame);
  assert.equal(hashState(resumed.simulation.state), hashState(snapshot));
  assert.equal(resumed.confirmed, snapshot.frame - 1);
  assert.equal(resumed.desync, 'OK');
  const sent: number[] = [];
  resumed.schedule(Button.Light, frame => sent.push(frame));
  assert.deepEqual(sent, Array.from({length: resumed.inputDelay + 1}, (_, i) => snapshot.frame + i), 'every missing frame is sent in order');
  resumed.schedule(Button.Light, frame => sent.push(frame));
  assert.equal(sent.length, resumed.inputDelay + 1, 'already scheduled frames are not resent');
  // History was cleared by the restore: a correction older than the checkpoint cannot be replayed.
  resumed.receive(snapshot.frame - 3, Button.Light);
  assert.equal(resumed.desync, 'Missing rollback snapshot');
});

test('state history keeps a bounded window of snapshots', () => {
  const history = new StateHistory(3);
  const g = new GameSimulation(['gut', 'tocha']);
  for (let f = 0; f < 10; f++) { history.set(f, g.snapshot()); g.step([0, 0]); }
  assert.equal(history.get(5), undefined);
  assert.ok(history.get(6)); assert.ok(history.get(9));
});
