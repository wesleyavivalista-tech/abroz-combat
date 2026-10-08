import {diagnosticId,type DiagnosticSink} from './observability.js';
import {VerifiedMatch} from './verifiedMatch.js';
import {GameSimulation} from '../../../packages/game-core/simulation/GameSimulation.js';
import {stages, trainingRoom} from "../../../packages/game-core/stages/registry.js";
import { ChampionshipSession } from "./championship.js";
import { resolveSkin } from "../../../packages/game-core/characters/skins.js";
import { randomInt } from "node:crypto";
import type { WebSocket } from "ws";
import type { ServerMessage, OnlineMode } from "../../../packages/shared/protocol.js";
import { characters } from "../../../packages/game-core/characters/registry.js";
interface Peer {
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
  constructor(private diagnostic:DiagnosticSink=()=>{}){}
  private record(event:string,room:Room,reason?:string):void{
    try{this.diagnostic(event,{roomId:room.diagnosticId,mode:room.mode,participants:room.peers.filter(p=>p.connected).length,reason});}catch{/* Never affect match behavior. */}
  }
  diagnosticRoomId(socket:WebSocket):string|undefined{return this.membership.get(socket)?.diagnosticId;}
  private recordCompletion(room:Room):void{
    if(!room.completedLogged&&(room.verification?.simulation.state.phase==='result'||room.championship?.completedAt!==undefined)){
      room.completedLogged=true;this.record('match-completed',room);
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
  create(socket: WebSocket, character: string, capacity = 2, mode: OnlineMode = "ffa", team?: number, skin?: string, stage = trainingRoom.id): void {
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
    this.leave(socket);
    let code = "";
    do {
      code = Array.from(
        { length: 5 },
        () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[randomInt(31)],
      ).join("");
    } while (this.rooms.has(code));
    const room: Room = {
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
  ready(socket: WebSocket): void {
    const room = this.membership.get(socket);
    if (!room || room.started) return;
    const peer = room.peers.find((p) => p.socket === socket);
    if (!peer || peer.ready) return;
    peer.ready = true;
    this.roster(room);
    if (
      room.peers.length === room.capacity &&
      room.peers.every((p) => p.ready) &&
      !room.started
    ) {
      room.started = true;
      this.record('match-started',room);
      if (room.mode === "championship") { room.championship = new ChampionshipSession(room.peers, send, stages[room.stage]); return; }
      room.peers.forEach(p=>{p.lastProgress=Date.now();p.warned=false;});
      const chars = room.peers.map((p) => p.character);
      const seed=randomInt(0x100000000);
      room.verification=new VerifiedMatch(new GameSimulation(chars,false,stages[room.stage],room.peers.map(p=>p.team),room.peers.map(p=>p.skin),room.mode==='elimination'||room.mode==='elimination-party'?room.mode:room.mode==='ffa-tournament',seed),
        (frame,hash)=>room.peers.filter(p=>p.connected).forEach(p=>send(p.socket,{type:'hash',seat:-1,frame,hash})));
      room.peers.forEach((p) =>
        send(p.socket, {
          type: "start",
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
  input(socket: WebSocket, frame: number, mask: number, matchId?: string): void {
    const room = this.membership.get(socket);
    if (!room?.started) throw new Error("Match has not started");
    if (room.championship) { room.championship.input(socket, matchId, frame, mask); this.recordCompletion(room); return; }
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
    if(peer.warned){peer.warned=false;room.peers.filter(p=>p.connected).forEach(p=>send(p.socket,{type:"input-wait",seat:room.peers.indexOf(peer),seconds:0}));}
    others.forEach((other) =>
      send(other.socket, {
        type: "input",
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
    peer.connected = false;
    this.record('room-left',room,reason);
    if (room.championship) { room.championship.leave(socket); } else if (room.started) {
      // Keep seats stable; the first missing input is the deterministic forfeit frame.
      room.peers
        .filter((p) => p.connected)
        .forEach((p) =>
          send(p.socket, { type: "left", seat, frame: peer.lastFrame + 1 }),
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
    this.recordCompletion(room);
    if (!room.peers.some((p) => p.connected)) {this.record('room-closed',room,room.started&&!room.completedLogged?'abandoned':reason);this.rooms.delete(room.code);}
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
  championshipReady(socket: WebSocket, matchId: string): void {
    this.membership.get(socket)?.championship?.acknowledge(socket, matchId);
  }
  finished(socket:WebSocket,frame:number):void{
    const room=this.membership.get(socket),peer=room?.peers.find(p=>p.socket===socket);
    if(room?.started&&peer&&Number.isInteger(frame)&&frame>=0&&frame<=peer.lastFrame){peer.finishedFrame=frame;peer.finishedAt??=Date.now();}
  }
  /** Only the input watermark can stall the room; peers ahead of it are waiting, not idle. */
  expireInactive(now=Date.now()):void{
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
          connected.forEach(other=>send(other.socket,{type:'input-wait',seat:room.peers.indexOf(p),seconds:Math.ceil((limit-idle)/1000)}));
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
