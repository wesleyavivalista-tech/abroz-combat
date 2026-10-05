import "./fixtures/legacy-roster.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { WebSocket } from "ws";
import { RoomService } from "../apps/server/src/rooms.js";
import { GameSimulation, hashState } from "../packages/game-core/simulation/GameSimulation.js";
import { resolveKnockouts } from "../packages/game-core/simulation/LifeSystem.js";
import { characters } from "../packages/game-core/characters/registry.js";
import { RollbackManager } from "../packages/networking/RollbackManager.js";
import { Button } from "../packages/game-core/types.js";
import type { ServerMessage } from "../packages/shared/protocol.js";
const ids = (n: number) => Array.from({length:n}, () => "prototype-a");
const teams = (n: number) => Array.from({length:n}, (_, i) => i % 2);
function match(n = 4) {
  const s = new GameSimulation(ids(n), false, undefined, teams(n));
  s.state.phase = "fight";s.state.fighters.forEach(f => f.state = "Idle");return s;
}
function client() {
  const messages: ServerMessage[] = [];
  return {messages, socket:{readyState:1,send:(data: string)=>messages.push(JSON.parse(data))} as unknown as WebSocket};
}
for (const n of [4,6]) {
  test(`${n/2}v${n/2} team elimination, respawn eligibility and disconnect victory`, () => {
    const sim=match(n);
    for(let i=1;i<n;i+=2) {
      sim.step(Array(n).fill(0),[i]);
      assert.equal(sim.state.phase,i===n-1 ? "result":"fight");
    }
    assert.equal(sim.state.teams[sim.state.winner],0);
    assert.ok(sim.state.fighters.every((f,i)=>i%2 ? f.lives===0 : f.lives===3));
    const respawn=match(n);respawn.state.fighters[1].health=0;
    resolveKnockouts(respawn.state);
    for(let i=3;i<n;i+=2) respawn.step(Array(n).fill(0),[i]);
    assert.equal(respawn.state.phase,"fight");
    for(let i=0;i<121;i++)respawn.step(Array(n).fill(0));
    assert.equal(respawn.state.fighters[1].lives,2);assert.ok(respawn.state.fighters[1].health>0);
    const draw=match(n);draw.state.fighters.forEach(f=>Object.assign(f,{health:0,lives:1}));resolveKnockouts(draw.state);
    assert.equal(draw.state.phase,"result");assert.equal(draw.state.winner,-1);
  });
  test(`${n/2}v${n/2} room balances teams and broadcasts identical assignments`, () => {
    const service=new RoomService(), clients=Array.from({length:n},client);
    service.create(clients[0].socket,"prototype-a",2,n===4?"2v2":"3v3",1);
    const code=[...service.rooms.keys()][0];service.ready(clients[0].socket);
    for(let i=1;i<n;i++){service.join(clients[i].socket,code,"prototype-a");service.ready(clients[i].socket);}
    const start=clients[0].messages.find(m=>m.type==="start")!;
    assert.equal(start.type,"start");if(start.type!=="start")throw new Error("No start");
    assert.equal(start.characters.length,n);assert.equal(start.teams.filter(t=>t===0).length,n/2);
    for(const c of clients)assert.deepEqual(c.messages.find(m=>m.type==="start"),start);
    service.leave(clients[0].socket);assert.equal(service.membership.size,n-1);
    assert.equal(clients[1].messages.at(-1)?.type,"left");
  });
}
test("teammates cannot be hit by melee, direct damage, supers or projectiles; facing stays player-controlled",()=>{
  const sim=match();const [a,enemy,ally,far]=sim.state.fighters;
  Object.assign(a,{x:500});Object.assign(ally,{x:570});Object.assign(enemy,{x:900});Object.assign(far,{x:1500});
  for(const m of Object.values(characters[a.characterId].moves))sim.hit(0,m,0,false,2);
  assert.equal(ally.health,1400);assert.equal(ally.meter,40);
  a.move="light";a.moveFrame=characters[a.characterId].moves.light.startupFrames;
  sim.step([0,0,0,0]);assert.equal(ally.health,1400);
  a.move=null;Object.assign(ally,{x:450});Object.assign(a,{x:500,facing:-1});
  sim.step([0,0,0,0]);assert.equal(a.facing,-1);
  Object.assign(sim.state.projectiles[0],{active:true,owner:0,x:ally.x-10,y:80,vx:10,life:100,move:"special",serial:1});
  sim.step([0,0,0,0]);assert.equal(ally.health,1400);assert.equal(sim.state.projectiles[0].active,true);
  sim.state.projectiles[0].x=enemy.x-10;sim.step([0,0,0,0]);assert.ok(enemy.health<1400);
});
test("team choice enforces capacity and waiting-room departures preserve assignments",()=>{
  const service=new RoomService(), c=Array.from({length:5},client);
  service.create(c[0].socket,"prototype-a",4,"2v2",0);const code=[...service.rooms.keys()][0];
  service.join(c[1].socket,code,"prototype-a",0);
  assert.throws(()=>service.join(c[2].socket,code,"prototype-a",0),/full/);
  assert.equal(service.membership.has(c[2].socket),false);
  service.join(c[2].socket,code,"prototype-a",1);service.leave(c[0].socket);
  service.join(c[3].socket,code,"prototype-a",0);service.join(c[4].socket,code,"prototype-a",1);
  for(const i of [1,2,3,4])service.ready(c[i].socket);
  const start=c[1].messages.find(m=>m.type==="start");assert.equal(start?.type,"start");
  if(start?.type==="start")assert.deepEqual(start.teams,[0,1,0,1]);
  assert.throws(()=>service.create(client().socket,"prototype-a",4,"2v2",5),/Invalid team/);
  assert.throws(()=>new GameSimulation(ids(4),false,undefined,[0,0,0,1]),/balanced/);
});

for (const count of [4,6]) test(`${count/2}v${count/2} rollback converges with delayed inputs and jitter`, () => {
  const roster = ids(count);
  const peers = roster.map(
    (_, seat) => new RollbackManager(new GameSimulation(roster, false, undefined, teams(count)), seat),
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
            ? seat % 2 === 0
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
  const baseline = new GameSimulation(roster, false, undefined, teams(count));
  for (let frame = 0; frame < 400; frame++)
    baseline.step(roster.map((_, seat) => (frame < 2 ? 0 : mask(seat, frame))));
  peers.forEach((p) => {
    assert.equal(p.simulation.state.frame, 400);
    assert.equal(p.desync, "OK");
    assert.equal(hashState(p.simulation.state), hashState(baseline.state));
  });
});

test("late teammate departure rolls back consistently without ending the team match", () => {
  const peers = [0, 1].map(seat => new RollbackManager(new GameSimulation(ids(6), false, undefined, teams(6)), seat, 0, 8));
  for (let frame = 0; frame < 240; frame++) {
    peers.forEach(peer => {
      peer.local.set(frame, 0);
      for (let seat = 0; seat < 6; seat++)
        if (seat !== peer.seat && (seat !== 4 || frame < 160)) peer.receive(frame, 0, seat);
      if (frame === (peer.seat === 0 ? 160 : 165)) peer.disconnect(4, 160);
      assert.equal(peer.tick(), true);
    });
  }
  assert.equal(hashState(peers[0].simulation.state), hashState(peers[1].simulation.state));
  assert.equal(peers[0].simulation.state.fighters[4].lives, 0);
  assert.equal(peers[0].simulation.state.phase, "fight");
  assert.ok(peers[1].rollbackCount > 0);
});
