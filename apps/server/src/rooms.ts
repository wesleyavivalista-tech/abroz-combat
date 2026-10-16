import {randomArena} from '../../../packages/game-core/stages/random.js';
import {ReconnectSeats,RECONNECT_GRACE_MS} from './reconnectSeats.js';
import {diagnosticId,type DiagnosticSink} from './observability.js';
import {VerifiedMatch} from './verifiedMatch.js';
import {GameSimulation} from '../../../packages/game-core/simulation/GameSimulation.js';
import {stages, trainingRoom} from "../../../packages/game-core/stages/registry.js";
import { ChampionshipSession } from "./championship.js";
import { resolveSkin } from "../../../packages/game-core/characters/skins.js";
import { randomInt, randomUUID } from "node:crypto";
import type { WebSocket } from "ws";
import type { ServerMessage, OnlineMode, RoomSettings, RoomSummary } from "../../../packages/shared/protocol.js";
import { characters } from "../../../packages/game-core/characters/registry.js";
interface Peer {
  returnRequested?:boolean;
  resumable:boolean;
  reconnectUntil?:number;
  neutralClock?:number;
  skin: string;
  team: number;
  socket: WebSocket;
  character: string;
  ready: boolean;
  connected: boolean;
  lastFrame: number;
  lastHashFrame: number;
  lastProgress: number;
  warned: boolean;
  finishedFrame?:number;
  finishedAt?:number;
  count: number;
  window: number;
}
interface Room {
  name:string;
  visibility:"public"|"private";
  owner:number;
  matchId?:string;
  initialSeed?:number;
  matchStage?:string;
  diagnosticId:string;
  completedLogged?:boolean;
  stage: string;
  championship?: ChampionshipSession;
  verification?: VerifiedMatch;
  mode: OnlineMode;
  code: string;
  peers: Peer[];
  started: boolean;
  capacity: number;
  created: number;
}
export const RESULT_RETENTION_MS=15*60*1000;
export const MAX_SOCKET_BUFFER_BYTES=1024*1024;
export function send(socket: WebSocket, message: ServerMessage): void {
  if(socket.readyState!==1)return;
  // A hard queue budget bounds memory; close uses the normal disconnect/forfeit path.
  if(socket.bufferedAmount>MAX_SOCKET_BUFFER_BYTES){socket.terminate();return;}
  socket.send(JSON.stringify(message));
}
export class RoomService {
  constructor(private diagnostic:DiagnosticSink=()=>{},private recoveryEnabled=false){}
  private seats=new ReconnectSeats();
  private capabilities=new WeakMap<WebSocket,boolean>();
  allowRecovery(socket:WebSocket,allowed:boolean):void{this.capabilities.set(socket,allowed);}
  checkpoint(){return {seats:this.seats.checkpoint(),rooms:[...this.rooms.values()].filter(r=>r.started).map(r=>({code:r.code,name:r.name,visibility:r.visibility,owner:r.owner,matchId:r.matchId,initialSeed:r.initialSeed,matchStage:r.matchStage,diagnosticId:r.diagnosticId,completedLogged:r.completedLogged,stage:r.stage,mode:r.mode,capacity:r.capacity,created:r.created,peers:r.peers.map(({socket: _socket,...p})=>p),verification:r.verification?.recovery(0),championship:r.championship?.checkpoint()}))};}
  restoreCheckpoint(data:ReturnType<RoomService['checkpoint']>,savedAt:number):void{
    if(!this.recoveryEnabled||this.rooms.size)throw Error('Cannot restore into an active server');
    this.seats.restore(data.seats,savedAt);
    for(const saved of data.rooms){
      if(!Object.hasOwn(stages,saved.stage))throw Error('Invalid checkpoint stage');
      const peers=saved.peers.map(p=>({...p,socket:{readyState:3,bufferedAmount:0,send:()=>{},close:()=>{},terminate:()=>{}} as unknown as WebSocket,connected:false,neutralClock:Date.now(),reconnectUntil:p.connected?savedAt+RECONNECT_GRACE_MS:p.reconnectUntil}));
      const room:Room={...saved,peers,started:true,verification:undefined,championship:undefined};
      if(saved.championship){room.championship=new ChampionshipSession(peers,send,stages[room.stage]);room.championship.restoreCheckpoint(saved.championship);}
      if(saved.verification){room.verification=new VerifiedMatch(new GameSimulation(peers.map(p=>p.character),false,stages[room.matchStage??room.stage]),(frame,hash)=>room.peers.filter(p=>p.connected).forEach(p=>send(p.socket,{type:'hash',matchId:room.matchId,seat:-1,frame,hash})));room.verification.restoreRecovery(saved.verification);}
      this.rooms.set(room.code,room);
      for(const peer of [...room.peers])if(!peer.resumable&&peer.reconnectUntil){this.membership.set(peer.socket,room);this.leave(peer.socket,'legacy-client-restart');}
    }
  }
  private issue(room:Room,peer:Peer):void{if(this.recoveryEnabled&&peer.resumable)send(peer.socket,{type:'resume-token',token:this.seats.issue(room.code,room.peers.indexOf(peer))});}
  detach(socket:WebSocket,reason:string,now=Date.now()):void{
    const room=this.membership.get(socket),peer=room?.peers.find(p=>p.socket===socket);
    if(!this.recoveryEnabled||!room?.started||!peer||!peer.resumable||!['peer-closed','heartbeat-timeout','socket-error'].includes(reason)){this.leave(socket,reason);return;}
    this.membership.delete(socket);peer.connected=false;peer.reconnectUntil=now+RECONNECT_GRACE_MS;peer.neutralClock=now;
    this.roster(room);
    this.seats.reserve(room.code,room.peers.indexOf(peer),now);this.record('seat-reserved',room);
  }
  resume(socket:WebSocket,token:unknown,now=Date.now()):void{
    if(!this.recoveryEnabled||this.membership.has(socket))throw Error('Reconnect unavailable');
    const identity=this.seats.identify(token),oldRoom=identity?this.rooms.get(identity.room):undefined,oldPeer=identity?oldRoom?.peers[identity.seat]:undefined;
    // Possession of the unguessable credential proves ownership. Replace a
    // half-open transport atomically rather than waiting for TCP timeout.
    if(oldPeer?.connected){const old=oldPeer.socket;this.detach(old,'peer-closed',now);old.terminate();}
    const claim=this.seats.claim(token,now);if(!claim)throw Error('Reconnect expired or unavailable. Return to the menu.');
    const room=this.rooms.get(claim.room),peer=room?.peers[claim.seat];
    if(!room||!peer||peer.connected||!peer.reconnectUntil||now>=peer.reconnectUntil)throw Error('Reconnect expired or unavailable. Return to the menu.');
    peer.socket=socket;peer.connected=true;peer.reconnectUntil=undefined;peer.neutralClock=undefined;peer.lastProgress=now;peer.window=now;peer.count=0;peer.warned=false;
    this.membership.set(socket,room);send(socket,{type:'resume-token',token:claim.token});
    if(peer.returnRequested){send(socket,{type:'resume',seat:claim.seat,stage:room.stage,mode:room.mode});send(socket,{type:'room-returned',code:room.code,seat:claim.seat});this.roster(room);}
    else if(room.championship){const state=room.championship.recovery(socket);send(socket,{type:'resume',stage:room.stage,mode:room.mode,bracket:room.championship.bracket,ready:[...room.championship.ready],...state});if(!state.state)room.championship.watch(socket);}
    else send(socket,{type:'resume',matchId:room.matchId,seat:claim.seat,stage:room.matchStage??room.stage,mode:room.mode,state:room.verification!.recovery(peer.lastFrame+1)});
    this.record('seat-resumed',room);
  }
  recoveryTick(now=Date.now()):void{
    if(!this.recoveryEnabled)return;
    for(const expired of this.seats.expire(now)){
      const room=this.rooms.get(expired.room),peer=room?.peers[expired.seat];
      if(room&&peer&&!peer.connected&&peer.reconnectUntil){this.membership.set(peer.socket,room);this.leave(peer.socket,'reconnect-expired');}
    }
    for(const room of this.rooms.values()){
      if(room.championship){room.championship.neutralDisconnected(now);continue;}
      if(!room.verification)continue;
      const live=room.peers.filter(p=>p.connected);
      const liveTarget=live.length?Math.max(...live.map(p=>p.lastFrame)):undefined;
      room.peers.forEach((peer,seat)=>{
        if(!peer.reconnectUntil)return;
        const clock=peer.neutralClock??now;
        const steps=Math.min(120,Math.max(0,Math.floor((now-clock)*60/1000)));
        const target=liveTarget??peer.lastFrame+steps;
        peer.neutralClock=live.length?now:clock+steps*1000/60;
        for(let n=0;peer.lastFrame<target&&n<120;n++){
          const frame=++peer.lastFrame;
          live.forEach(p=>send(p.socket,{type:'input',matchId:room.matchId,seat,frame,mask:0}));room.verification!.receive(seat,frame,0);
        }
      });this.recordCompletion(room);
    }
  }
  private record(event:string,room:Room,reason?:string):void{
    try{this.diagnostic(event,{roomId:room.diagnosticId,mode:room.mode,participants:room.peers.filter(p=>p.connected).length,reason});}catch{/* Never affect match behavior. */}
  }
  diagnosticRoomId(socket:WebSocket):string|undefined{return this.membership.get(socket)?.diagnosticId;}
  private recordCompletion(room:Room):void{
    const state=room.verification?.simulation.state;
    if(!room.completedLogged&&((state?.phase==='result'&&(!state.tournament||state.tournament.complete)&&(!state.elimination||state.elimination.complete))||room.championship?.completedAt!==undefined)){
      room.completedLogged=true;this.record('match-completed',room);
      const statistics=room.verification?.simulation.state.statistics;
      if(statistics?.finalized)room.peers.filter(p=>p.connected).forEach(p=>send(p.socket,{type:'match-statistics',matchId:room.matchId,statistics}));
    }
  }
  capacitySnapshot(){
    let waitingRooms=0,activeRooms=0,activeMatches=0,resultRooms=0;
    for(const room of this.rooms.values()){
      if(!room.started)waitingRooms++;
      else if(room.verification?.simulation.state.phase==='result'||room.championship?.completedAt!==undefined)resultRooms++;
      else {activeRooms++;activeMatches+=room.championship?room.championship.duels.size:room.verification?1:0;}
    }
    return {waitingRooms,activeRooms,activeMatches,resultRooms};
  }
  rooms = new Map<string, Room>();
  membership = new Map<WebSocket, Room>();
  create(socket: WebSocket, character: string, capacity = 2, mode: OnlineMode = "ffa", team?: number, skin?: string, stage = trainingRoom.id, name = "", visibility:"public"|"private" = "private"): void {
    if (!["championship", "ffa", "ffa-tournament", "elimination", "elimination-party", "2v2", "3v3"].includes(mode)) throw new Error("Invalid match mode");
    if (team !== undefined && team !== 0 && team !== 1) throw new Error("Invalid team");
    if ((mode === "2v2" || mode === "3v3")) capacity = mode === "2v2" ? 4 : 6;
    if(mode === "elimination-party") capacity=6;
    if (typeof stage !== "string" || !Object.hasOwn(stages, stage)) throw new Error("Invalid arena");
    this.validateCharacter(character);
    const selectedSkin = resolveSkin(characters[character], skin);
    if (!Number.isInteger(capacity) || capacity < 2 || capacity > (mode === "championship" ? 16 : 8))
      throw new Error(`Room size must be 2–${mode === "championship" ? 16 : 8} fighters`);
    if (this.rooms.size >= 1000) throw new Error("Server full");
    this.validateSettings({name,visibility});
    this.leave(socket);
    let code = "";
    do {
      code = Array.from(
        { length: 5 },
        () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[randomInt(31)],
      ).join("");
    } while (this.rooms.has(code));
    const room: Room = {
      name:name.trim(),visibility,owner:0,
      diagnosticId:diagnosticId(),
      code,
      stage,
      mode,
      peers: [this.peer(socket, character, (mode === "ffa" || mode === "ffa-tournament" || mode.startsWith("elimination")) ? 0 : (team ?? 0), selectedSkin)],
      started: false,
      capacity,
      created: Date.now(),
    };
    this.rooms.set(code, room);
    this.record('room-created',room);
    this.membership.set(socket, room);
    send(socket, { type: "room", code, seat: 0 });
    this.roster(room);
  }
  join(socket: WebSocket, code: string, character: string, requestedTeam?: number, skin?: string): void {
    if (requestedTeam !== undefined && requestedTeam !== 0 && requestedTeam !== 1) throw new Error("Invalid team");
    this.validateCharacter(character);
    const selectedSkin = resolveSkin(characters[character], skin);
    const room = this.rooms.get(code.toUpperCase());
    if (!room) throw new Error("Room not found");
    if (this.membership.get(socket) === room)
      throw new Error("Already in this room");
    if (room.started)
      throw new Error("This match has already started. Reconnecting isn’t supported yet. Return to the menu to join or create another room.");
    if (room.peers.length === room.capacity)
      throw new Error("Room is full");
    let team = room.peers.length;
    if ((room.mode === "2v2" || room.mode === "3v3")) {
      const counts = [0, 1].map(t => room.peers.filter(p => p.team === t).length);
      team = requestedTeam ?? (counts[0] <= counts[1] ? 0 : 1);
      if (counts[team] >= room.capacity / 2) throw new Error("That team is full. Choose another team or Auto balance.");
    }
    this.leave(socket);
    room.peers.push(this.peer(socket, character, team, selectedSkin));
    this.membership.set(socket, room);
    this.record('room-joined',room);
    send(socket, {
      type: "room",
      code: room.code,
      seat: room.peers.length - 1,
    });
    this.roster(room);
  }
  private validateSettings(settings:RoomSettings):void {
    if(!settings||typeof settings!=="object"||Array.isArray(settings))throw Error("Invalid room settings");
    if(settings.name!==undefined&&(typeof settings.name!=="string"||settings.name.length>40||[...settings.name].some(c=>c.charCodeAt(0)<32)))throw Error("Room name must be at most 40 characters");
    if(settings.visibility!==undefined&&!["public","private"].includes(settings.visibility))throw Error("Invalid room privacy");
    if(settings.stage!==undefined&&(typeof settings.stage!=='string'||!Object.hasOwn(stages,settings.stage)))throw Error("Invalid arena");
    if(settings.mode!==undefined&&!["ffa","ffa-tournament","championship","elimination","elimination-party","2v2","3v3"].includes(settings.mode))throw Error("Invalid match mode");
  }
  private editable(socket:WebSocket){
    const room=this.membership.get(socket),peer=room?.peers.find(p=>p.socket===socket);
    if(!room||!peer||!peer.connected||room.started&&(!room.completedLogged||!peer.returnRequested))throw Error("Return to the lobby to make changes");
    return {room,peer};
  }
  list(socket:WebSocket):void {send(socket,{type:'rooms',rooms:[...this.rooms.values()].filter(r=>r.visibility==='public').slice(0,1000).map(r=>this.summary(r))});}
  private summary(room:Room):RoomSummary{return {code:room.code,name:room.name||`Arena ${room.code}`,capacity:room.capacity,count:room.peers.filter(p=>p.connected||p.reconnectUntil).length,mode:room.mode,status:room.started?'playing':room.peers.length>=room.capacity?'full':'waiting'};}
  configure(socket:WebSocket,settings:RoomSettings):void{
    const {room}=this.editable(socket);
    if(room.peers[room.owner]?.socket!==socket)throw Error("Only the Room Owner can change settings");
    this.validateSettings(settings);
    const mode=settings.mode??room.mode;
    const capacity=mode==='2v2'?4:mode==='3v3'||mode==='elimination-party'?6:settings.capacity??room.capacity;
    if(!Number.isInteger(capacity)||capacity<Math.max(2,room.peers.filter(p=>p.connected||p.reconnectUntil).length)||capacity>(mode==='championship'?16:8))throw Error("Invalid room size for this mode or player count");
    const changedMode=room.mode!==mode;
    room.name=settings.name?.trim()??room.name;room.visibility=settings.visibility??room.visibility;room.stage=settings.stage??room.stage;room.capacity=capacity;room.mode=mode;
    room.peers.forEach((p,i)=>{p.ready=false;if(changedMode)p.team=mode==='2v2'||mode==='3v3'?i%2:i;});
    this.roster(room);
  }
  choose(socket:WebSocket,character:string,skin?:string):void{
    const {room,peer}=this.editable(socket);this.validateCharacter(character);
    peer.character=character;peer.skin=resolveSkin(characters[character],skin);peer.ready=false;this.roster(room);
  }
  ready(socket: WebSocket,ready=true): void {
    if(typeof ready!=='boolean')throw Error("Invalid readiness");
    const current=this.membership.get(socket);if(current?.started&&!current.completedLogged)return;
    const {room,peer}=this.editable(socket);if(peer.ready===ready)return;peer.ready=ready;this.roster(room);
  }
  private startReason(room:Room):string{
    if(room.started)return room.completedLogged?'Waiting for players to return from results':'Match in progress';
    if(room.peers.length<2)return 'Waiting for at least 2 players';
    if(['2v2','3v3','elimination-party'].includes(room.mode)&&room.peers.length!==room.capacity)return `Waiting for ${room.capacity} players`;
    if((room.mode==='2v2'||room.mode==='3v3')&&[0,1].some(t=>room.peers.filter(p=>p.team===t).length!==room.capacity/2))return 'Teams must be balanced';
    if(!room.peers.every(p=>p.connected&&p.ready))return 'Every player must be ready';
    return '';
  }
  startMatch(socket:WebSocket):void {
    const room=this.membership.get(socket);
    if(!room||room.peers[room.owner]?.socket!==socket)throw Error("Only the Room Owner can start the match");
    if(room.started)return;
    const reason=this.startReason(room);if(reason)throw Error(reason);
    {
      room.started = true;
      if(room.mode!=="championship")room.stage=randomArena(room.stage);
      room.matchStage=room.stage;
      // Lobby seats can shift when somebody leaves; mint credentials only once
      // match seats become stable.
      room.peers.forEach(p=>this.issue(room,p));
      this.record('match-started',room);
      if (room.mode === "championship") { room.championship = new ChampionshipSession(room.peers, send, stages[room.stage]); return; }
      room.peers.forEach(p=>{p.lastProgress=Date.now();p.warned=false;});
      const chars = room.peers.map((p) => p.character);
      const seed=randomInt(0x100000000);room.initialSeed=seed;
      room.verification=new VerifiedMatch(new GameSimulation(chars,false,stages[room.stage],room.peers.map(p=>p.team),room.peers.map(p=>p.skin),room.mode==='elimination'||room.mode==='elimination-party'?room.mode:room.mode==='ffa-tournament',seed),
        (frame,hash)=>room.peers.filter(p=>p.connected).forEach(p=>send(p.socket,{type:'hash',matchId:room.matchId,seat:-1,frame,hash})));
      room.peers.forEach((p) =>
        send(p.socket, {
          type: "start",
          matchId:room.matchId,
          stage: room.stage,
          seed,
          characters: chars,
          teams: room.peers.map(p => p.team),
          skins: room.peers.map(p => p.skin),
          mode: room.mode,
          inputDelay: 2,
          maxRollbackFrames: 8,
        }),
      );
    }
  }
  returnToRoom(socket:WebSocket,matchId?:string):void{
    const room=this.membership.get(socket),peer=room?.peers.find(p=>p.socket===socket);
    if(!room||!peer||!room.started)return;
    this.recordCompletion(room);
    if(!room.completedLogged||(!room.championship&&matchId!==room.matchId))return;
    if(!peer.returnRequested){peer.returnRequested=true;peer.ready=false;send(socket,{type:'room-returned',code:room.code,seat:room.peers.indexOf(peer)});}
    this.tryReturnToRoom(room);this.roster(room);
  }
  private tryReturnToRoom(room:Room):void{
    if(!room.completedLogged)return;
    const connected=room.peers.filter(p=>p.connected);
    if(!connected.length||connected.some(p=>!p.returnRequested)||room.peers.some(p=>p.reconnectUntil))return;
    const owner=room.peers[room.owner];
    room.peers.forEach((_,seat)=>this.seats.revoke(room.code,seat));
    room.peers=connected;room.owner=Math.max(0,connected.indexOf(owner));room.started=false;room.verification=undefined;room.championship=undefined;room.completedLogged=false;room.created=Date.now();room.matchId=randomUUID();
    connected.forEach((p,seat)=>{if(room.mode!=='2v2'&&room.mode!=='3v3')p.team=seat;p.returnRequested=false;p.lastFrame=1;p.lastHashFrame=-1;p.finishedFrame=undefined;p.finishedAt=undefined;p.lastProgress=Date.now();p.warned=false;p.count=0;p.window=Date.now();send(p.socket,{type:'room',code:room.code,seat});});
    this.roster(room);
  }
  /** Restart is authorized by the room host, scoped to the current input generation. */
  restart(socket:WebSocket,matchId?:string):void{
    const room=this.membership.get(socket);
    if(room?.championship){room.championship.restart(socket,matchId);return;}
    if(!room?.started||matchId!==room.matchId)return;
    if(room.peers[room.owner].socket!==socket||!room.peers.every(p=>p.connected)||!room.verification||room.verification.simulation.state.phase==='result'||room.initialSeed===undefined){send(socket,{type:'restart-denied'});return;}
    const previousId=room.matchId;room.matchId=randomUUID();room.completedLogged=false;
    room.verification=new VerifiedMatch(new GameSimulation(room.peers.map(p=>p.character),false,stages[room.stage],room.peers.map(p=>p.team),room.peers.map(p=>p.skin),room.mode==='elimination'||room.mode==='elimination-party'?room.mode:room.mode==='ffa-tournament',room.initialSeed),
      (frame,hash)=>room.peers.filter(p=>p.connected).forEach(p=>send(p.socket,{type:'hash',matchId:room.matchId,seat:-1,frame,hash})));
    room.peers.forEach((p,seat)=>{
      p.lastFrame=1;p.lastHashFrame=-1;p.lastProgress=Date.now();p.warned=false;p.finishedFrame=undefined;p.finishedAt=undefined;p.count=0;p.window=Date.now();
      send(p.socket,{type:'fight-restarted',previousId,matchId:room.matchId!,seat,stage:room.stage,mode:room.mode,state:room.verification!.recovery(2)});
    });
    this.record('match-restarted',room);
  }
  input(socket: WebSocket, frame: number, mask: number, matchId?: string): void {
    const room = this.membership.get(socket);
    if(room&&!room.championship&&matchId!==room.matchId)return;
    if (!room?.started) throw new Error("Match has not started");
    if(room.peers.find(p=>p.socket===socket)?.returnRequested)return;
    if (room.championship) { room.championship.input(socket, matchId, frame, mask); this.recordCompletion(room); return; }
    if(matchId!==room.matchId)return;
    const peer = room.peers.find((p) => p.socket === socket)!;
    if (
      !Number.isInteger(frame) ||
      frame < 0 ||
      frame > 10_000_000 ||
      !Number.isInteger(mask) ||
      mask < 0 ||
      mask > 2047
    )
      throw new Error("Invalid input");
    if (frame !== peer.lastFrame + 1) throw new Error("Out-of-order input");
    const others = room.peers.filter((p) => p !== peer && p.connected);
    if (others.some((other) => frame > other.lastFrame + 120))
      throw new Error("Input too far ahead");
    if (Date.now() - peer.window > 1000) {
      peer.window = Date.now();
      peer.count = 0;
    }
    if (++peer.count > 180) throw new Error("Input rate exceeded");
    peer.lastFrame = frame;
    peer.lastProgress=Date.now();
    if(peer.warned){peer.warned=false;room.peers.filter(p=>p.connected).forEach(p=>send(p.socket,{type:"input-wait",matchId:room.matchId,seat:room.peers.indexOf(peer),seconds:0}));}
    others.forEach((other) =>
      send(other.socket, {
        type: "input",
        matchId:room.matchId,
        seat: room.peers.indexOf(peer),
        frame,
        mask,
      }),
    );
    room.verification!.receive(room.peers.indexOf(peer),frame,mask);
    this.recordCompletion(room);
  }
  relayHash(socket: WebSocket, frame: number, hash: string, matchId?: string): void {
    const room = this.membership.get(socket);
    if (room?.championship) { room.championship.hash(socket, matchId, frame, hash); return; }
    const peer = room?.peers.find((p) => p.socket === socket);
    if (
      !room?.started ||
      matchId!==room.matchId ||
      !peer ||
      !Number.isInteger(frame) ||
      frame < 0 ||
      frame > peer.lastFrame ||
      frame <= peer.lastHashFrame ||
      frame % 60 !== 0 ||
      !/^[a-f0-9]{1,8}$/.test(hash)
    )
      return;
    peer.lastHashFrame = frame;
    // Client checksums are untrusted diagnostics. Only settled server simulation
    // emits hashes; forwarding a false claim would let a peer abort other clients.
  }

  leave(socket: WebSocket,reason='leave'): void {
    const room = this.membership.get(socket);
    if (!room) return;
    const seat = room.peers.findIndex((p) => p.socket === socket);
    const peer = room.peers[seat];
    this.membership.delete(socket);
    peer.connected = false;peer.reconnectUntil=undefined;this.seats.revoke(room.code,seat);
    this.record('room-left',room,reason);
    const owner=room.peers[room.owner];
    if(room.completedLogged){ /* Results are immutable; leaving only changes membership. */ } else if (room.championship) { room.championship.leave(socket); } else if (room.started) {
      // Keep seats stable; the first missing input is the deterministic forfeit frame.
      room.peers
        .filter((p) => p.connected)
        .forEach((p) =>
          send(p.socket, { type: "left", matchId:room.matchId, seat, frame: peer.lastFrame + 1 }),
        );
      room.verification!.leave(seat,peer.lastFrame+1);
    } else {
      room.peers.splice(seat, 1);
      if ((room.mode === "ffa" || room.mode === "ffa-tournament" || room.mode.startsWith("elimination"))) room.peers.forEach((p, i) => p.team = i);
      room.peers.forEach((p, seat) =>
        send(p.socket, { type: "room", code: room.code, seat }),
      );
      this.roster(room);
    }
    room.owner=owner&&(owner.connected||owner.reconnectUntil)?room.peers.indexOf(owner):Math.max(0,room.peers.findIndex(p=>p.connected));
    this.recordCompletion(room);this.tryReturnToRoom(room);this.roster(room);
    if (!room.peers.some((p) => p.connected||p.reconnectUntil)) {this.record('room-closed',room,room.started&&!room.completedLogged?'abandoned':reason);this.rooms.delete(room.code);}
  }
  expire(): void {
    for (const room of this.rooms.values())
      if (!room.started && Date.now() - room.created > 15 * 60_000)
        for (const peer of [...room.peers]) {
          send(peer.socket, { type: "error", message: "Waiting room expired" });
          this.leave(peer.socket,'waiting-expired');
          peer.socket.close();
        }
  }
  spectate(socket:WebSocket,token?:string):void{this.membership.get(socket)?.championship?.watch(socket,token);}
  championshipReady(socket: WebSocket, matchId: string): void {
    this.membership.get(socket)?.championship?.acknowledge(socket, matchId);
  }
  finished(socket:WebSocket,frame:number,matchId?:string):void{
    const room=this.membership.get(socket),peer=room?.peers.find(p=>p.socket===socket);
    if(room?.started&&matchId===room.matchId&&peer&&Number.isInteger(frame)&&frame>=0&&frame<=peer.lastFrame){peer.finishedFrame=frame;peer.finishedAt??=Date.now();}
  }
  /** Only the input watermark can stall the room; peers ahead of it are waiting, not idle. */
  expireInactive(now=Date.now()):void{
    this.recoveryTick(now);
    for(const room of this.rooms.values()){
      if(!room.started)continue;
      if (room.championship) {
        if(room.championship.completedAt!==undefined&&now-room.championship.completedAt>=RESULT_RETENTION_MS){
          for(const peer of room.peers.filter(p=>p.connected)){send(peer.socket,{type:'error',message:'Finished tournament closed after 15 minutes. Return to the menu to play again.'});this.leave(peer.socket,'results-expired');peer.socket.close();}
          continue;
        }
        for (const socket of room.championship.expired(now)) {
          send(socket, { type: "error", message: "Tournament match forfeited after inactivity." });
          this.leave(socket,'inactivity'); socket.close();
        }
        continue;
      }
      const connected=room.peers.filter(p=>p.connected);
      if(room.completedLogged){
        for(const p of connected.filter(p=>!p.returnRequested&&now-(p.finishedAt??p.lastProgress)>=RESULT_RETENTION_MS)){this.leave(p.socket,'results-expired');p.socket.close();}
        continue;
      }
      if(room.verification?.simulation.state.phase==='result'&&connected.length&&connected.every(p=>p.finishedFrame!==undefined&&p.finishedFrame===connected[0].finishedFrame)){
        if(now-Math.max(...connected.map(p=>p.finishedAt??now))>=RESULT_RETENTION_MS){
          for(const p of connected){send(p.socket,{type:'error',message:'Finished room closed after 15 minutes. Return to the menu to play again.'});this.leave(p.socket,'results-expired');p.socket.close();}
        }
        continue;
      }
      const watermark=Math.min(...connected.map(p=>p.lastFrame));
      const expired:Peer[]=[];
      for(const p of connected.filter(p=>p.lastFrame===watermark)){
        const limit=p.lastFrame===1?120_000:60_000;
        const idle=now-p.lastProgress;
        if(idle>=limit)expired.push(p);
        else if(idle>=limit-30_000&&!p.warned){
          p.warned=true;
          connected.forEach(other=>send(other.socket,{type:'input-wait',matchId:room.matchId,seat:room.peers.indexOf(p),seconds:Math.ceil((limit-idle)/1000)}));
        }
      }
      for(const p of expired){
        send(p.socket,{type:'error',message:'No gameplay input received before the inactivity deadline. Return to the menu to play again.'});
        this.leave(p.socket,'inactivity');
        p.socket.close();
      }
      // Peers previously blocked by an expired player need time to resume after the departure.
      if(expired.length)room.peers.filter(p=>p.connected).forEach(p=>{p.lastProgress=now;});
    }
  }
  private roster(room: Room): void {
    room.peers.filter(p=>p.connected).forEach((peer)=>send(peer.socket,{type:'room-state',room:{...this.summary(room),seat:room.peers.indexOf(peer),owner:room.owner,visibility:room.visibility,stage:room.stage,startReason:this.startReason(room),players:room.peers.map(p=>({character:p.character,skin:p.skin,team:p.team,ready:p.ready,connected:p.connected,status:p.reconnectUntil?'reconnecting':!p.connected?'left':room.started&&!p.returnRequested?'results':'lobby'}))}}));
    room.peers.forEach((peer) =>
      send(peer.socket, {
        type: "roster",
        stage: room.stage,
        capacity: room.capacity,
        mode: room.mode,
        players: room.peers.map((p) => ({
          character: p.character,
          ready: p.ready,
          team: p.team,
          skin: p.skin,
        })),
      }),
    );
  }
  private peer(socket: WebSocket, character: string, team: number, skin: string): Peer {
    return {
      resumable:this.capabilities.get(socket)??true,
      skin,
      team,
      socket,
      character,
      ready: false,
      connected: true,
      lastFrame: 1,
      lastHashFrame: -1,
      lastProgress: Date.now(),
      warned: false,
      count: 0,
      window: Date.now(),
    };
  }
  private validateCharacter(character: string): void {
    if (typeof character !== "string" || !Object.hasOwn(characters, character))
      throw new Error("Unknown character");
  }
}
