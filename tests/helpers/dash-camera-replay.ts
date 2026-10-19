import {GameSimulation, hashState} from '../../packages/game-core/simulation/GameSimulation.js';
import {RollbackManager} from '../../packages/networking/RollbackManager.js';
import {Button, type SimulationSnapshot} from '../../packages/game-core/types.js';

/** Real double-tap inputs delivered late to two real rollback peers. No position injection. */
export function dashCameraReplay(delay: number, render: (state: SimulationSnapshot) => void) {
  const peers = [0, 1].map(seat => {
    const simulation = new GameSimulation(['nikalz', 'jopa']);
    simulation.state.phase = 'fight';
    return new RollbackManager(simulation, seat);
  });
  const queue: {due: number; target: RollbackManager; frame: number; mask: number; seat: number}[] = [];
  let dashFrames = 0;
  for (let clock = 0; clock < 720; clock++) {
    for (const [seat, peer] of peers.entries()) {
      const frame = peer.simulation.state.frame + peer.inputDelay;
      const cycle = frame % 64;
      const direction = Math.floor(frame / 64) % 2 ? Button.Right : Button.Left;
      const mask = seat === 1 && (cycle === 0 || cycle >= 3 && cycle < 22) ? direction : 0;
      peer.schedule(mask, (frame, mask) => queue.push({due: clock + delay + (delay ? frame % 3 : 0), target: peers[1-seat], frame, mask, seat}));
    }
    for (let i = queue.length - 1; i >= 0; i--) if (queue[i].due <= clock) {
      const input = queue.splice(i, 1)[0];
      input.target.receive(input.frame, input.mask, input.seat, true);
    }
    for (const peer of peers) peer.tick();
    if (peers[0].simulation.state.fighters[1].state.startsWith('Dash')) dashFrames++;
    render(peers[0].simulation.state);
  }
  queue.sort((a,b) => a.frame-b.frame).forEach(input => input.target.receive(input.frame,input.mask,input.seat));
  return {dashFrames, rollbacks: peers[0].rollbackCount, converged: hashState(peers[0].simulation.state) === hashState(peers[1].simulation.state), desync: peers.map(p=>p.desync)};
}
