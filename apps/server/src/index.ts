import {createLogger,diagnosticId,errorFields} from './observability.js';
import {allowedOrigins,clientAddress} from './deployment.js';
import {contentVersion} from '../../../packages/shared/contentVersion.js';
import {monitorEventLoopDelay} from 'node:perf_hooks';
import {Admission,positiveLimit} from './admission.js';
import {assertCompatibleContent} from '../../../packages/shared/contentVersion.js';
import { createServer, type IncomingMessage } from "node:http";
import { WebSocketServer } from "ws";
import { RoomService, send } from "./rooms.js";
const log=createLogger();
const rooms = new RoomService(log);
const admission=new Admission(positiveLimit(process.env.MAX_CONNECTIONS,256),positiveLimit(process.env.MAX_CONNECTIONS_PER_ADDRESS,32),positiveLimit(process.env.MAX_UPGRADES_PER_MINUTE,120));
const production=process.env.NODE_ENV==='production';
const origins=allowedOrigins(process.env.ALLOWED_ORIGINS,production);
const trustFly=process.env.TRUST_FLY_PROXY==='1';
if(trustFly&&!process.env.FLY_APP_NAME)throw new Error('Fly proxy trust requires the Fly deployment environment');
const version=contentVersion();
let draining=false;
const server = createServer((req, res) => {
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  if(!['GET','HEAD'].includes(req.method??'')){res.writeHead(405);res.end();return;}
  const path=req.url?.split('?')[0];
  if(!['/','/healthz','/readyz'].includes(path??'')){res.writeHead(404);res.end();return;}
  res.writeHead(path==='/readyz'&&draining?503:200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status: draining?'draining':'ok', rooms: rooms.rooms.size, connections:wss.clients.size, contentVersion:version }));
});
const wss = new WebSocketServer({
  server,
  maxPayload: 1024,
  verifyClient: (info: {origin:string;req:IncomingMessage}) => {
    let reason:string|undefined;
    if(draining)reason='maintenance';
    else if(info.origin&&!origins.includes(info.origin))reason='origin-rejected';
    else {const address=clientAddress(info.req,trustFly);if(address===undefined)reason='address-unavailable';else if(!admission.allow(address))reason='admission-limit';}
    if(reason)log('connection-rejected',{reason});
    return !reason;
  },
});
wss.on("connection", (socket,request) => {
  const release=admission.connect(clientAddress(request,trustFly)!);
  const connectionId=diagnosticId();
  let closeReason='peer-closed';
  log('connection-open',{connectionId});
  let alive = true;
  let budget = 0;
  let window = Date.now();
  socket.on("pong", () => (alive = true));
  const timer = setInterval(() => {
    if (!alive) {
      closeReason='heartbeat-timeout';
      socket.terminate();
      return;
    }
    alive = false;
    socket.ping();
  }, 30000);
  socket.on("message", (data) => {
    let operation='parse';
    try {
      if (Date.now() - window > 1000) {
        window = Date.now();
        budget = 0;
      }
      if (++budget > 240) { closeReason='message-rate-limit';socket.terminate(); return; }
      const m = JSON.parse(data.toString());
      if (!m || typeof m !== "object" || Array.isArray(m) || typeof m.type !== "string") throw new Error("Invalid message");
      operation=['create','join','ready','championship-ready','finished','input','hash','ping'].includes(m.type)?m.type:'unknown';
      switch (m.type) {
        case "create":
        case "join":
          if(draining)throw new Error('Server maintenance: new rooms are temporarily unavailable.');
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
      log('message-failed',{connectionId,roomId:rooms.diagnosticRoomId(socket),operation,...errorFields(error)});
      send(socket, {
        type: "error",
        message: error instanceof Error ? error.message : "Invalid message",
      });
    }
  });
  socket.on("close", (code) => {
    log('connection-close',{connectionId,roomId:rooms.diagnosticRoomId(socket),code,reason:closeReason});
    release();
    clearInterval(timer);
    rooms.leave(socket,closeReason);
  });
  socket.on("error", (error) => {closeReason='socket-error';log('socket-error',{connectionId,...errorFields(error)});socket.close();});
});
const delay=monitorEventLoopDelay({resolution:20});
if(production)delay.enable();
const metrics=production?setInterval(()=>{
 log('server-health',{rooms:rooms.rooms.size,connections:wss.clients.size,rssMiB:Math.round(process.memoryUsage().rss/1048576),eventLoopP95Ms:Math.round(delay.percentile(95)/1e6),draining});delay.reset();
},60000):undefined;
// Maintenance rejects new connections/rooms; existing matches continue normally.
process.on('SIGUSR2',()=>{draining=true;log('draining',{rooms:rooms.rooms.size});});
const progressExpiry=setInterval(()=>rooms.expireInactive(),1000);
const expiry = setInterval(() => rooms.expire(), 60000);
server.listen(Number(process.env.PORT ?? 8080), "0.0.0.0", () => {
  log('server-start',{port:(server.address() as {port:number}).port});
  console.log(
    "ABROZ COMBAT room server listening on port " +
      (server.address() as { port: number }).port,
  );
});
process.on('uncaughtExceptionMonitor',error=>log('fatal-error',errorFields(error)));
let stopping=false;
function stop() {
  if(stopping)return;stopping=true;draining=true;
  log('server-stop',{rooms:rooms.rooms.size,connections:wss.clients.size});
  if(metrics)clearInterval(metrics);delay.disable();
  const deadline=setTimeout(()=>{wss.clients.forEach(s=>s.terminate());server.closeAllConnections();},5000);deadline.unref();
  clearInterval(expiry);
  clearInterval(progressExpiry);
  wss.clients.forEach((s) => s.close());
  wss.close();
  server.close();
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
