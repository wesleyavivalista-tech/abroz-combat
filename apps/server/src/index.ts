import {readMatchPerformance} from '../../../packages/shared/matchPerformance.js';
import {PersistentChampionshipService} from './persistent/service.js';
import {RecoveryStore} from './recoveryStore.js';
import {LobbyBudget,LOBBY_RATE_ERROR,RoomlessDeadline} from './lobbyProtection.js';
import {stepMetrics} from './capacityMetrics.js';
import {createLogger,diagnosticId,errorFields} from './observability.js';
import {allowedOrigins,clientAddress} from './deployment.js';
import {contentVersion} from '../../../packages/shared/contentVersion.js';
import {monitorEventLoopDelay} from 'node:perf_hooks';
import {Admission,positiveLimit} from './admission.js';
import {assertCompatibleContent,VersionMismatchError} from '../../../packages/shared/contentVersion.js';
import { createServer, type IncomingMessage } from "node:http";
import { WebSocketServer } from "ws";
import { RoomService, send } from "./rooms.js";
const log=createLogger();
const persistentPath=process.env.ABROZ_CHAMPIONSHIP_PATH;
const championshipStore=persistentPath?new (await import('./persistent/store.js')).ChampionshipStore(persistentPath):undefined;
const persistent=championshipStore?new PersistentChampionshipService(championshipStore,send):undefined;
const rooms = new RoomService(log,process.env.ABROZ_RECOVERY_ENABLED==='1');
const recoveryStore=process.env.ABROZ_RECOVERY_ENABLED==='1'&&process.env.ABROZ_RECOVERY_PATH?new RecoveryStore(process.env.ABROZ_RECOVERY_PATH):undefined;
if(recoveryStore){try{const saved=await recoveryStore.load();if(saved)rooms.restoreCheckpoint(saved.data,saved.savedAt);}catch{log('recovery-load-failed',{});throw Error('Recovery checkpoint could not be safely loaded');}}
const checkpointTimer=recoveryStore?setInterval(()=>{void recoveryStore.save(rooms.checkpoint()).catch(()=>log('recovery-save-failed',{}));},1000):undefined;
const lobbyBudget=new LobbyBudget();
const admission=new Admission(positiveLimit(process.env.MAX_CONNECTIONS,256),positiveLimit(process.env.MAX_CONNECTIONS_PER_ADDRESS,32),positiveLimit(process.env.MAX_UPGRADES_PER_MINUTE,120));
const production=process.env.NODE_ENV==='production';
const capacityTest=process.env.NODE_ENV==='test'&&process.env.ABROZ_CAPACITY_TEST==='1'&&!process.env.FLY_APP_NAME;
const origins=allowedOrigins(process.env.ALLOWED_ORIGINS,production);
const trustFly=process.env.TRUST_FLY_PROXY==='1';
if(trustFly&&!process.env.FLY_APP_NAME)throw new Error('Fly proxy trust requires the Fly deployment environment');
const version=contentVersion();
let draining=false;
const server = createServer((req, res) => {
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  if(!['GET','HEAD'].includes(req.method??'')){res.writeHead(405);res.end();return;}
  const path=req.url?.split('?')[0];
  if(path==='/capacity-test'&&capacityTest){
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({pid:process.pid,cpu:process.cpuUsage(),rss:process.memoryUsage().rss,eventLoopP95Ms:delay.percentile(95)/1e6,...stepMetrics.snapshot(),...rooms.capacitySnapshot(),connections:wss.clients.size}));return;
  }
  if(path==='/connection-status'){
    const origin=req.headers.origin;
    if(origin&&!origins.includes(origin)){res.writeHead(403);res.end();return;}
    if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
    const address=clientAddress(req,trustFly);
    const reason=draining?'Server maintenance: new rooms are temporarily unavailable.':address===undefined?undefined:admission.reason(address);
    res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({reason}));return;
  }
  if(!['/','/healthz','/readyz'].includes(path??'')){res.writeHead(404);res.end();return;}
  res.writeHead(path==='/readyz'&&draining?503:200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status: draining?'draining':'ok', rooms: rooms.rooms.size, connections:wss.clients.size, capacity:admission.maximum, ...rooms.capacitySnapshot(), contentVersion:version }));
});
const wss = new WebSocketServer({
  server,
  maxPayload: 8192,
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
  const address=clientAddress(request,trustFly)!;
  const release=admission.connect(address);
  const roomless=new RoomlessDeadline();
  const connectionId=diagnosticId();
  let closeReason='peer-closed';
  let lastPerformanceLog=-Infinity;
  log('connection-open',{connectionId});
  let alive = true;
  let budget = 0;
  let lastBrowse=0,lobbyChanges=0,lobbyWindow=Date.now();
  let window = Date.now();
  socket.on("pong", () => (alive = true));
  const timer = setInterval(() => {
    if(roomless.expired(rooms.membership.has(socket)||!!persistent?.has(socket)||!!persistent?.watching(socket))){closeReason='roomless-timeout';socket.terminate();return;}
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
      operation=['create','join','ready','championship-ready','restart-fight','return-room','finished','input','hash','ping'].includes(m.type)?m.type:'unknown';
      if(['ready','room-settings','choose-fighter','start-match','spectate','return-room'].includes(m.type)){
        if(Date.now()-lobbyWindow>1000){lobbyWindow=Date.now();lobbyChanges=0;}
        if(++lobbyChanges>20)throw Error(LOBBY_RATE_ERROR);
      }
      if(m.type==='persistent'){
        assertCompatibleContent(m.contentVersion);
        if(!persistent)throw Error('Persistent Championships are not enabled on this server yet');
        if(draining&&['create','claim','ready'].includes(m.action))throw Error('Server maintenance: please try again shortly');
        if(rooms.membership.has(socket))throw Error('Leave your current room first');
        if(Date.now()-lobbyWindow>1000){lobbyWindow=Date.now();lobbyChanges=0;}
        if(++lobbyChanges>10)throw Error(LOBBY_RATE_ERROR);
        roomless.expired(true);persistent.command(socket,m,address);return;
      }
      if(persistent?.has(socket)){
        if(m.type==='input')persistent.input(socket,m.frame,m.mask,m.matchId);
        else if(m.type==='leave')persistent.leave(socket);
        else if(!['hash','finished','ping'].includes(m.type))throw Error('Leave your championship fighter first');
        if(m.type!=='ping')return;
      }
      switch (m.type) {
        case 'leave': rooms.leave(socket,'intentional-leave');break;
        case 'resume':
          if(!lobbyBudget.allow(socket,address))throw new Error(LOBBY_RATE_ERROR);
          assertCompatibleContent(m.contentVersion);rooms.resume(socket,m.token);break;
        case "create":
        case "join":
          if(!lobbyBudget.allow(socket,address))throw new Error(LOBBY_RATE_ERROR);
          if(draining)throw new Error('Server maintenance: new rooms are temporarily unavailable.');
          assertCompatibleContent(m.contentVersion);
          rooms.allowRecovery(socket,m.recovery===1);
          if (m.type === "create")
            rooms.create(socket, m.character, m.capacity, m.mode, m.team, m.skin, m.stage, m.name, m.visibility);
          else {
            if (typeof m.code !== "string" || !/^[A-Z0-9]{5}$/i.test(m.code))
              throw new Error("Invalid room code");
            rooms.join(socket, m.code, m.character, m.team, m.skin);
          }
          roomless.expired(rooms.membership.has(socket)||!!persistent?.has(socket)||!!persistent?.watching(socket));
          break;
        case "championship-ready":
          if (typeof m.matchId === "string") rooms.championshipReady(socket, m.matchId);
          break;
        case "return-room":
          if(m.matchId!==undefined&&(typeof m.matchId!=="string"||m.matchId.length>100))throw new Error("Invalid match ID");
          rooms.returnToRoom(socket,m.matchId);break;
        case "restart-fight":
          if(m.matchId!==undefined&&(typeof m.matchId!=="string"||m.matchId.length>100))throw new Error("Invalid match ID");
          rooms.restart(socket,m.matchId);
          break;
        case "finished":
          rooms.finished(socket,m.frame,m.matchId);
          break;
        case 'list-rooms':
          assertCompatibleContent(m.contentVersion);if(Date.now()-lastBrowse<1000)break;lastBrowse=Date.now();roomless.expired(true);rooms.list(socket);break;
        case 'spectate': if(m.matchId!==undefined&&(typeof m.matchId!=='string'||m.matchId.length>100))throw Error('Invalid match ID');rooms.spectate(socket,m.matchId);break;
        case 'room-settings': rooms.configure(socket,m.settings);break;
        case 'choose-fighter': rooms.choose(socket,m.character,m.skin);break;
        case 'start-match': rooms.startMatch(socket);break;
        case "ready":
          rooms.ready(socket,m.ready);
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
          if(Date.now()-lastPerformanceLog>=15000){
            const sample=readMatchPerformance(m.performance),room=rooms.membership.get(socket);
            const context=persistent?.diagnosticContext(socket)??(room?.started?{matchId:room.matchId,seat:room.peers.findIndex(p=>p.socket===socket),roomId:room.diagnosticId}:undefined);
            if(sample&&context){lastPerformanceLog=Date.now();log('match-performance',{connectionId,...context,...sample});}
          }
          break;
        default:
          throw new Error("Unknown message");
      }
    } catch (error) {
      log('message-failed',{connectionId,roomId:rooms.diagnosticRoomId(socket),operation,...errorFields(error)});
      send(socket, {
        type: "error",
        message: error instanceof Error ? error.message : "Invalid message",
        ...(error instanceof VersionMismatchError?{code:error.code,expected:error.expected,received:error.received}:{}),
      });
    }
  });
  socket.on("close", (code) => {
    log('connection-close',{connectionId,roomId:rooms.diagnosticRoomId(socket),code,reason:closeReason});
    release();
    persistent?.leave(socket);
    clearInterval(timer);
    if(stopping)rooms.leave(socket,closeReason);else rooms.detach(socket,closeReason);
  });
  socket.on("error", (error) => {closeReason='socket-error';log('socket-error',{connectionId,...errorFields(error)});socket.close();});
});
const delay=monitorEventLoopDelay({resolution:20});
if(production||capacityTest)delay.enable();
const metrics=production?setInterval(()=>{
 let socketQueueBytes=0,maxSocketQueueBytes=0;for(const socket of wss.clients){socketQueueBytes+=socket.bufferedAmount;maxSocketQueueBytes=Math.max(maxSocketQueueBytes,socket.bufferedAmount);}
 log('server-health',{...rooms.capacitySnapshot(),...stepMetrics.snapshot(),socketQueueBytes,maxSocketQueueBytes,capacity:admission.maximum,rooms:rooms.rooms.size,connections:wss.clients.size,rssMiB:Math.round(process.memoryUsage().rss/1048576),eventLoopP95Ms:Math.round(delay.percentile(95)/1e6),draining});delay.reset();stepMetrics.reset();
},60000):undefined;
// Maintenance rejects new connections/rooms; existing matches continue normally.
process.on('SIGUSR2',()=>{draining=true;log('draining',{rooms:rooms.rooms.size});});
const recoveryTick=process.env.ABROZ_RECOVERY_ENABLED==='1'?setInterval(()=>rooms.recoveryTick(),16):undefined;
const progressExpiry=setInterval(()=>{rooms.expireInactive();persistent?.expire();},1000);
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
  if(checkpointTimer)clearInterval(checkpointTimer);
  if(metrics)clearInterval(metrics);delay.disable();
  const deadline=setTimeout(()=>{wss.clients.forEach(s=>s.terminate());server.closeAllConnections();},5000);deadline.unref();
  if(recoveryTick)clearInterval(recoveryTick);
  clearInterval(expiry);
  clearInterval(progressExpiry);
  wss.clients.forEach((s) => {persistent?.leave(s);s.close();});
  wss.close();
  server.close();
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
