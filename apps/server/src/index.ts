import {Admission,positiveLimit} from './admission.js';
import {assertCompatibleContent} from '../../../packages/shared/contentVersion.js';
import { createServer, type IncomingMessage } from "node:http";
import { WebSocketServer } from "ws";
import { RoomService, send } from "./rooms.js";
const rooms = new RoomService();
const admission=new Admission(positiveLimit(process.env.MAX_CONNECTIONS,256),positiveLimit(process.env.MAX_CONNECTIONS_PER_ADDRESS,32),positiveLimit(process.env.MAX_UPGRADES_PER_MINUTE,120));
const origins = (
  process.env.ALLOWED_ORIGINS ?? "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,http://127.0.0.1:5175,abroz://game"
).split(",");
const server = createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status: "ok", rooms: rooms.rooms.size }));
});
const wss = new WebSocketServer({
  server,
  maxPayload: 1024,
  verifyClient: (info: {origin:string;req:IncomingMessage}) =>
    (!info.origin || origins.includes(info.origin)) && admission.allow(info.req.socket.remoteAddress ?? "unknown"),
});
wss.on("connection", (socket,request) => {
  const release=admission.connect(request.socket.remoteAddress ?? "unknown");
  let alive = true;
  let budget = 0;
  let window = Date.now();
  socket.on("pong", () => (alive = true));
  const timer = setInterval(() => {
    if (!alive) {
      socket.terminate();
      return;
    }
    alive = false;
    socket.ping();
  }, 30000);
  socket.on("message", (data) => {
    try {
      if (Date.now() - window > 1000) {
        window = Date.now();
        budget = 0;
      }
      if (++budget > 240) { socket.terminate(); return; }
      const m = JSON.parse(data.toString());
      if (!m || typeof m !== "object" || Array.isArray(m) || typeof m.type !== "string") throw new Error("Invalid message");
      switch (m.type) {
        case "create":
        case "join":
          assertCompatibleContent(m.contentVersion);
          if (m.type === "create")
            rooms.create(socket, m.character, m.capacity, m.mode, m.team, m.skin, m.stage);
          else {
            if (typeof m.code !== "string" || !/^[A-Z0-9]{5}$/i.test(m.code))
              throw new Error("Invalid room code");
            rooms.join(socket, m.code, m.character, m.team, m.skin);
          }
          break;
        case "championship-ready":
          if (typeof m.matchId === "string") rooms.championshipReady(socket, m.matchId);
          break;
        case "finished":
          rooms.finished(socket,m.frame);
          break;
        case "ready":
          rooms.ready(socket);
          break;
        case "input":
          rooms.input(socket, m.frame, m.mask, m.matchId);
          break;
        case "hash":
          if (typeof m.hash === "string")
            rooms.relayHash(socket, m.frame, m.hash, m.matchId);
          break;
        case "ping":
          if (typeof m.sent === "number" && Number.isFinite(m.sent))
            send(socket, { type: "pong", sent: m.sent });
          break;
        default:
          throw new Error("Unknown message");
      }
    } catch (error) {
      send(socket, {
        type: "error",
        message: error instanceof Error ? error.message : "Invalid message",
      });
    }
  });
  socket.on("close", () => {
    release();
    clearInterval(timer);
    rooms.leave(socket);
  });
  socket.on("error", () => socket.close());
});
const progressExpiry=setInterval(()=>rooms.expireInactive(),1000);
const expiry = setInterval(() => rooms.expire(), 60000);
server.listen(Number(process.env.PORT ?? 8080), "0.0.0.0", () =>
  console.log(
    "ABROZ COMBAT room server listening on port " +
      (server.address() as { port: number }).port,
  ),
);
function stop() {
  clearInterval(expiry);
  clearInterval(progressExpiry);
  wss.clients.forEach((s) => s.close());
  wss.close();
  server.close();
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
