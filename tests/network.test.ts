import {RenderInterpolation} from '../apps/client/src/rendering/RenderInterpolation.js';
import {contentVersion} from '../packages/shared/contentVersion.js';
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { WebSocket } from "ws";
import {
  GameSimulation,
  hashState,
} from "../packages/game-core/simulation/GameSimulation.js";
import { RollbackManager } from "../packages/networking/RollbackManager.js";
import { Button } from "../packages/game-core/types.js";
import type { ServerMessage } from "../packages/shared/protocol.js";
for (const roster of [undefined,['nikalz','luizinho']])
for (const latency of [0, 50, 100, 150, 200])
  test(`${roster?.join(" vs ")??"default fighters"}: two peers converge with ${latency}ms input latency and jitter`, () => {
    const a = new RollbackManager(new GameSimulation(roster), 0),
      b = new RollbackManager(new GameSimulation(roster), 1);
    const displays = [new RenderInterpolation(), new RenderInterpolation()];
    const queue: {
      due: number;
      target: RollbackManager;
      frame: number;
      mask: number;
    }[] = [];
    const frames = 420;
    const mask = (seat: number, frame: number) =>
      frame < 180
        ? seat === 0
          ? Button.Right
          : Button.Left
        : frame % 40 === 0
          ? Button.Heavy
          : frame % 23 === 0
            ? Button.Special2
            : frame % 29 === 0
              ? Button.Special
              : frame % 17 === 0
                ? Button.Light
                : 0;
    for (
      let clock = 0;
      clock < 3000 &&
      (a.simulation.state.frame < frames || b.simulation.state.frame < frames);
      clock++
    ) {
      for (const [peer, index, target] of [
        [a, 0, b],
        [b, 1, a],
      ] as const) {
        if (peer.simulation.state.frame >= frames) continue;
        peer.schedule(
          mask(index, peer.simulation.state.frame + 2),
          (frame, input) =>
            queue.push({
              due: clock + Math.ceil(latency / 16.667) + (frame % 3),
              target,
              frame,
              mask: input,
            }),
        );
      }
      for (let i = queue.length - 1; i >= 0; i--)
        if (queue[i].due <= clock) {
          const item = queue.splice(i, 1)[0];
          item.target.receive(item.frame, item.mask);
        }
      for (const [i, peer] of [a, b].entries()) {
        displays[i].capture(peer.simulation.state);
        if (peer.simulation.state.frame < frames) peer.tick();
        const authoritative = hashState(peer.simulation.state);
        for (const alpha of [0, .25, .5, .75]) displays[i].view(peer.simulation.state, alpha);
        assert.equal(hashState(peer.simulation.state), authoritative);
      }
    }
    queue
      .sort((x, y) => x.frame - y.frame)
      .forEach((item) => item.target.receive(item.frame, item.mask));
    assert.equal(a.simulation.state.frame, frames);
    assert.equal(b.simulation.state.frame, frames);
    assert.equal(hashState(a.simulation.state), hashState(b.simulation.state));
    assert.equal(a.desync, "OK");
    assert.equal(b.desync, "OK");
    const baseline = new GameSimulation(roster);
    for (let frame = 0; frame < frames; frame++)
      baseline.step(frame < 2 ? [0, 0] : [mask(0, frame), mask(1, frame)]);
    assert.equal(hashState(a.simulation.state), hashState(baseline.state));
  });
for (const peerOrigins of [["http://localhost:5173", "http://localhost:5173"], ["abroz://game", "http://localhost:5173"], ["abroz://game", "abroz://game"]])
test(`real WebSocket create/join/ready/input/hash/disconnect: ${peerOrigins.join(" ↔ ")}`, async () => {
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "apps/server/src/index.ts"],
    { env: { ...process.env, PORT: "0", ALLOWED_ORIGINS: "http://localhost:5173,abroz://game" }, stdio: ["ignore", "pipe", "pipe"] },
  );
  const sockets: WebSocket[] = [];
  try {
    const port = await new Promise<number>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Server startup timeout")),
        8000,
      );
      child.stdout.on("data", (data) => {
        const match = data.toString().match(/port (\d+)/);
        if (match) {
          clearTimeout(timeout);
          resolve(Number(match[1]));
        }
      });
      child.on("error", reject);
    });
    const connect = async (origin: string) => {
      const socket = new WebSocket(`ws://localhost:${port}`, {origin});
      sockets.push(socket);
      await new Promise<void>((r, j) => {
        socket.once("open", () => r());
        socket.once("error", j);
      });
      return socket;
    };
    const messages = new Map<WebSocket, ServerMessage[]>();
    const a = await connect(peerOrigins[0]),
      b = await connect(peerOrigins[1]);
    for (const s of [a, b]) {
      messages.set(s, []);
      s.on("message", (d) => messages.get(s)!.push(JSON.parse(d.toString())));
    }
    const next = async (socket: WebSocket, type: string) => {
      const start = Date.now();
      while (Date.now() - start < 3000) {
        const queue = messages.get(socket)!;
        const i = queue.findIndex((m) => m.type === type);
        if (i >= 0) return queue.splice(i, 1)[0];
        await new Promise((r) => setTimeout(r, 5));
      }
      throw new Error("Missing message " + type);
    };
    a.send(JSON.stringify({type:"create",character:"gut",contentVersion:"obsolete"}));
    const incompatible=await next(a,"error");assert.equal(incompatible.type,"error");if(incompatible.type==='error'){assert.match(incompatible.message,/versions differ/);assert.equal(incompatible.code,'VERSION_MISMATCH');assert.equal(incompatible.expected,contentVersion());assert.equal(incompatible.received,'obsolete');}
    a.send(JSON.stringify({ type: "create", contentVersion:contentVersion(), character: "gut" }));
    const room = await next(a, "room");
    assert.equal(room.type, "room");
    if (room.type !== "room") return;
    assert.match(room.code, /^[A-Z0-9]{5}$/);
    b.send(
      JSON.stringify({
        type: "join", contentVersion:contentVersion(),
        code: room.code,
        character: "tocha",
      }),
    );
    await next(b, "room");
    a.send(JSON.stringify({ type: "ready" }));
    b.send(JSON.stringify({ type: "ready" }));b.send(JSON.stringify({type:"ping",sent:1}));await next(b,"pong");a.send(JSON.stringify({type:"start-match"}));
    const starts = await Promise.all([next(a, "start"), next(b, "start")]);
    assert.deepEqual(starts[0], starts[1]);
    a.send(JSON.stringify({ type: "input", frame: 2, mask: Button.Light }));
    assert.deepEqual(await next(b, "input"), {
      type: "input",
      seat: 0,
      frame: 2,
      mask: Button.Light,
    });
    a.send(JSON.stringify({ type: "input", frame: 3, mask: 4096 }));
    const error = await next(a, "error");
    assert.equal(error.type, "error");
    a.send(JSON.stringify({ type: "hash", frame: 0, hash: "abc123" }));
    a.send(JSON.stringify({type:'ping',sent:321}));
    assert.deepEqual(await next(a,'pong'),{type:'pong',sent:321});
    a.send(JSON.stringify({type:'ping',sent:322,diagnostics:true}));
    const timing=await next(a,'pong');assert.equal(timing.type,'pong');if(timing.type==='pong'){assert.equal(timing.sent,322);for(const value of [timing.processingMs,timing.simulationStepMeanMs,timing.simulationStepMaxMs])assert.ok(typeof value==='number'&&Number.isFinite(value)&&value>=0);}
    b.close();
    await next(a, "left");
  } finally {
    for (const socket of sockets) socket.terminate();
    child.kill();
  }
});

 test('prediction absorbs a short gap but remains bounded during a lost connection',()=>{
 const peer=new RollbackManager(new GameSimulation(),0);
 assert.equal(peer.inputDelay,2);assert.equal(peer.maxRollbackFrames,16);
 for(let i=0;i<18;i++){peer.schedule(0,()=>{});assert.equal(peer.tick(),true);}
 assert.equal(peer.tick(),false);assert.equal(peer.simulation.state.frame,18);
 for(let frame=2;frame<=18;frame++)peer.receive(frame,0);
 assert.equal(peer.tick(),true);assert.equal(peer.desync,'OK');
 });
