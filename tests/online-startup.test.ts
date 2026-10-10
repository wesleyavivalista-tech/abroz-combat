import test from 'node:test';
import assert from 'node:assert/strict';
import {GameSimulation, hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {RollbackManager} from '../packages/networking/RollbackManager.js';
import {Button} from '../packages/game-core/types.js';

for (const count of [2, 8]) for (const latency of [0, 3, 8]) {
  test(`${count} players: staggered loading with ${latency}-frame delivery waits before countdown and converges`, () => {
    const ids = Array.from({length: count}, (_, i) => i % 2 ? 'jopa' : 'nikalz');
    const make = () => new GameSimulation(ids, false, undefined, undefined, undefined, false, 123);
    const peers = ids.map((_, seat) => new RollbackManager(make(), seat));
    const loads = ids.map((_, seat) => seat * 30);
    const sent = ids.map(() => new Set<number>());
    const queue: {due: number; target: number; seat: number; frame: number; mask: number}[] = [];
    const input = (seat: number, frame: number) => frame < 2 ? 0 : frame % 40 < 20 ? (seat % 2 ? Button.Left : Button.Right) : Button.Light;
    const end = 300;
    for (let clock = 0; clock < 2400 && peers.some(p => p.simulation.state.frame < end); clock++) {
      peers.forEach((peer, seat) => {
        if (clock < loads[seat] || peer.simulation.state.frame >= end) return;
        peer.schedule(input(seat, peer.simulation.state.frame + 2), (frame, mask) => {
          assert.ok(!sent[seat].has(frame), 'waiting must not duplicate input');
          sent[seat].add(frame);
          peers.forEach((_, target) => {
            if (target !== seat) queue.push({due: clock + latency, target, seat, frame, mask});
          });
        });
      });
      for (let i = 0; i < queue.length;) {
        if (queue[i].due > clock) { i++; continue; }
        const p = queue.splice(i, 1)[0];
        peers[p.target].receive(p.frame, p.mask, p.seat);
      }
      peers.forEach((peer, seat) => {
        if (clock < loads[seat] || peer.simulation.state.frame >= end) return;
        // Same scheduling/gating order as the client loop.
        if (!peer.waitingForPeers) peer.tick();
        if (clock < loads[count - 1]) assert.equal(peer.simulation.state.frame, 0);
        assert.equal(peer.desync, 'OK');
      });
    }
    queue.forEach(p => peers[p.target].receive(p.frame, p.mask, p.seat));
    const baseline = make();
    for (let frame = 0; frame < end; frame++) baseline.step(ids.map((_, seat) => input(seat, frame)));
    for (const peer of peers) {
      assert.equal(peer.simulation.state.frame, end);
      assert.equal(hashState(peer.simulation.state), hashState(baseline.state));
    }
  });
}

test('startup gate accepts neutral input and releases a departed seat', () => {
  const peer = new RollbackManager(new GameSimulation(['nikalz','jopa','biel']), 0);
  assert.equal(peer.waitingForPeers, true);
  peer.receive(2, 0, 1);
  assert.equal(peer.waitingForPeers, true);
  peer.disconnect(2, 2);
  assert.equal(peer.waitingForPeers, false);
});

test('startup gate never suppresses genuine mid-match missing-input stalls', () => {
  const peer = new RollbackManager(new GameSimulation(), 0);
  peer.receive(2, 0, 1);
  assert.equal(peer.waitingForPeers, false);
  for (let i = 0; i < 20; i++) { peer.schedule(0, () => {}); peer.tick(); }
  assert.equal(peer.stalled, true);
  assert.equal(peer.waitingForPeers, false);
});
