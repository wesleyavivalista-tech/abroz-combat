import "./fixtures/legacy-roster.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GameSimulation,
  hashState,
} from "../packages/game-core/simulation/GameSimulation.js";
import { RollbackManager } from "../packages/networking/RollbackManager.js";
import { Button } from "../packages/game-core/types.js";
import { resolveKnockouts } from "../packages/game-core/simulation/LifeSystem.js";
import { RoomService } from "../apps/server/src/rooms.js";
import type { WebSocket } from "ws";
const ids = Array.from({ length: 6 }, (_, i) =>
  i % 2 ? "prototype-b" : "prototype-a",
);
function match() {
  const sim = new GameSimulation(ids);
  sim.state.phase = "fight";
  sim.state.fighters.forEach((f) => (f.state = "Idle"));
  return sim;
}
test("six fighters keep independent lives and match ends only with the last survivor", () => {
  const sim = match();
  assert.equal(sim.state.fighters.length, 6);
  for (let i = 0; i < 5; i++) {
    Object.assign(sim.state.fighters[i], { lives: 1, health: 0 });
    resolveKnockouts(sim.state);
    assert.equal(sim.state.phase, i === 4 ? "result" : "fight");
  }
  assert.equal(sim.state.winner, 5);
  assert.equal(sim.state.fighters[5].lives, 3);
});
test("six-way simultaneous final knockout draws; respawning players still count as survivors", () => {
  const sim = match();
  sim.state.fighters.forEach((f) => Object.assign(f, { health: 0, lives: 1 }));
  resolveKnockouts(sim.state);
  assert.equal(sim.state.winner, -1);
  assert.equal(sim.state.phase, "result");
  const respawn = match();
  respawn.state.fighters[5].health = 0;
  respawn.step([0, 0, 0, 0, 0, 0]);
  assert.equal(respawn.state.phase, "fight");
  for (let i = 0; i < 120; i++) respawn.step([0, 0, 0, 0, 0, 0]);
  assert.equal(respawn.state.fighters[5].health, 1400);
  assert.equal(respawn.state.fighters[5].lives, 2);
});
test("melee hits multiple opponents and seat five projectiles hit seat six without self damage", () => {
  const sim = match();
  Object.assign(sim.state.fighters[0], {
    x: 700,
    facing: 1,
    move: "heavy",
    moveFrame: 13,
  });
  Object.assign(sim.state.fighters[1], { x: 780 });
  Object.assign(sim.state.fighters[2], { x: 800 });
  for (let i = 0; i < 30; i++) sim.step([0, 0, 0, 0, 0, 0]);
  assert.ok(sim.state.fighters[1].health < 1400);
  assert.ok(sim.state.fighters[2].health < 1400);
  const projectiles = match();
  Object.assign(projectiles.state.projectiles[0], {
    active: true,
    owner: 4,
    x: 2100,
    y: 85,
    vx: 0,
    life: 20,
    move: "special",
  });
  projectiles.step([0, 0, 0, 0, 0, 0]);
  assert.ok(projectiles.state.fighters[5].health < 1400);
  assert.equal(projectiles.state.fighters[4].health, 1400);
});
test("six peers converge with independent late inputs, jitter and bounded prediction", () => {
  const peers = ids.map(
    (_, seat) => new RollbackManager(new GameSimulation(ids), seat),
  );
  const packets: {
    due: number;
    target: number;
    seat: number;
    frame: number;
    mask: number;
  }[] = [];
  const mask = (seat: number, frame: number) =>
    frame % (23 + seat) === 0
      ? Button.Special2
      : frame % 37 === 0
        ? Button.Up
        : frame % 41 === 0
          ? Button.Heavy
          : frame % 80 < 30
            ? seat < 3
              ? Button.Right
              : Button.Left
            : 0;
  for (
    let clock = 0;
    clock < 4000 && peers.some((p) => p.simulation.state.frame < 400);
    clock++
  ) {
    peers.forEach((peer, seat) => {
      if (peer.simulation.state.frame >= 400) return;
      peer.schedule(
        mask(seat, peer.simulation.state.frame + 2),
        (frame, input) =>
          peers.forEach((_, target) => {
            if (target !== seat)
              packets.push({
                due: clock + seat * 2 + (frame % 3),
                target,
                seat,
                frame,
                mask: input,
              });
          }),
      );
    });
    for (let i = packets.length - 1; i >= 0; i--)
      if (packets[i].due <= clock) {
        const packet = packets.splice(i, 1)[0];
        peers[packet.target].receive(packet.frame, packet.mask, packet.seat);
      }
    peers.forEach((p) => {
      if (p.simulation.state.frame < 400) p.tick();
    });
  }
  packets.forEach((p) => peers[p.target].receive(p.frame, p.mask, p.seat));
  const baseline = new GameSimulation(ids);
  for (let frame = 0; frame < 400; frame++)
    baseline.step(ids.map((_, seat) => (frame < 2 ? 0 : mask(seat, frame))));
  peers.forEach((p) => {
    assert.equal(p.simulation.state.frame, 400);
    assert.equal(p.desync, "OK");
    assert.equal(hashState(p.simulation.state), hashState(baseline.state));
  });
});
test("rooms validate capacity, wait for six, tag relay seats and continue after a disconnect", () => {
  const rooms = new RoomService();
  const clients = Array.from({ length: 7 }, () => {
    const messages: Record<string, unknown>[] = [];
    return {
      messages,
      socket: {
        readyState: 1,
        send: (data: string) => messages.push(JSON.parse(data)),
      } as unknown as WebSocket,
    };
  });
  assert.throws(() => rooms.create(clients[0].socket, ids[0], 9));
  assert.throws(() => rooms.create(clients[0].socket, ids[0], 1));
  rooms.create(clients[0].socket, ids[0], 6);
  const code = [...rooms.rooms.keys()][0];
  rooms.ready(clients[0].socket);
  for (let i = 1; i < 6; i++) {
    assert.ok(!clients[0].messages.some((m) => m.type === "start"));
    rooms.join(clients[i].socket, code, ids[i]);
    rooms.ready(clients[i].socket);
  }
  clients.slice(0, 6).forEach((client, seat) => {
    assert.equal(client.messages.find((m) => m.type === "room")!.seat, seat);
    assert.deepEqual(
      client.messages.find((m) => m.type === "start")!.characters,
      ids,
    );
  });
  assert.throws(() => rooms.join(clients[6].socket, code, ids[0]));
  rooms.input(clients[5].socket, 2, Button.Super2);
  clients.slice(0, 5).forEach((c) =>
    assert.deepEqual(c.messages.at(-1), {
      type: "input",
      seat: 5,
      frame: 2,
      mask: Button.Super2,
    }),
  );
  rooms.leave(clients[3].socket);
  assert.equal(rooms.rooms.size, 1);
  assert.equal(rooms.membership.size, 5);
  clients
    .slice(0, 6)
    .filter((_, i) => i !== 3)
    .forEach((c) => assert.equal(c.messages.at(-1)!.type, "left"));
});

test("late disconnect rolls back only that fighter; remaining peers advance without its inputs", () => {
  const peers = [0, 1].map(
    (seat) => new RollbackManager(new GameSimulation(ids), seat, 0, 8),
  );
  for (let frame = 0; frame < 240; frame++) {
    peers.forEach((peer) => {
      peer.local.set(frame, 0);
      for (let seat = 0; seat < 6; seat++)
        if (seat !== peer.seat && (seat !== 5 || frame < 160))
          peer.receive(frame, 0, seat);
      if (frame === (peer.seat === 0 ? 160 : 165)) peer.disconnect(5, 160);
      assert.equal(peer.tick(), true);
    });
  }
  assert.equal(
    hashState(peers[0].simulation.state),
    hashState(peers[1].simulation.state),
  );
  assert.equal(peers[0].simulation.state.fighters[5].lives, 0);
  assert.equal(peers[0].simulation.state.phase, "fight");
  assert.ok(peers[1].rollbackCount > 0);
});
test("disconnect during respawn and intro forfeits all lives; last remaining player wins", () => {
  const sim = new GameSimulation(["prototype-a", "prototype-b"]);
  const peer = new RollbackManager(sim, 0, 0);
  peer.disconnect(1, 0);
  peer.schedule(0, () => {});
  assert.equal(peer.tick(), true);
  assert.equal(sim.state.winner, 0);
  assert.equal(sim.state.phase, "result");
  const six = match();
  Object.assign(six.state.fighters[5], { health: 0, respawnAt: 120 });
  six.step([0, 0, 0, 0, 0, 0], [5]);
  assert.equal(six.state.fighters[5].lives, 0);
  assert.equal(six.state.fighters[5].respawnAt, 0);
  for (let i = 0; i < 140; i++) six.step([0, 0, 0, 0, 0, 0]);
  assert.equal(six.state.fighters[5].lives, 0);
});
test("waiting-room departure frees a slot and preserves the room", () => {
  const rooms = new RoomService();
  const socket = () =>
    ({ readyState: 1, send: () => {} }) as unknown as WebSocket;
  const a = socket(),
    b = socket(),
    c = socket(),
    d = socket();
  rooms.create(a, ids[0], 3);
  const code = [...rooms.rooms.keys()][0];
  rooms.join(b, code, ids[1]);
  rooms.leave(a);
  assert.equal(rooms.rooms.get(code)!.peers.length, 1);
  rooms.join(c, code, ids[2]);
  rooms.join(d, code, ids[3]);
  for (const peer of [b, c, d]) rooms.ready(peer);
  assert.equal(rooms.rooms.get(code)!.started, true);
  rooms.leave(b);
  rooms.leave(c);
  rooms.leave(d);
  assert.equal(rooms.rooms.size, 0);
});
