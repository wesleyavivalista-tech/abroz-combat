import {encodeSnapshot,decodeSnapshot} from '../../../packages/shared/recovery.js';
import {stepMetrics} from './capacityMetrics.js';
import {trainingRoom} from "../../../packages/game-core/stages/registry.js";
import type { WebSocket } from 'ws';
import { GameSimulation, hashState } from '../../../packages/game-core/simulation/GameSimulation.js';
import { createChampionship, currentMatches, finishBracketMatch, findMatch, matchToken, startBracketMatch, withdrawEntrant, type Entrant } from '../../../packages/game-core/tournament/Championship.js';
import type { ServerMessage } from '../../../packages/shared/protocol.js';
interface Participant { socket: WebSocket; character: string; skin: string; connected: boolean; reconnectUntil?:number;neutralClock?:number }
interface Duel {
  simulation: GameSimulation; players: [number, number]; token: string;
  inputs: [Map<number, number>, Map<number, number>]; last: [number, number]; lastHash: [number, number]; progress: [number, number];
}
/** Tournament seats never change. Duel seats and packets are scoped to one match attempt. */
export class ChampionshipSession {
  bracket;
  completedAt?: number;
  ready = new Set<number>();
  duels = new Map<string, Duel>();
  private watchers=new Map<number,string>();
  private awaiting = new Map<number, number>();
  constructor(private peers: Participant[], private send: (socket: WebSocket, message: ServerMessage) => void, private stage = trainingRoom) {
    const entrants: Entrant[] = peers.map((p, id) => ({ id, name: `Player ${id + 1}`, character: p.character, skin: p.skin }));
    this.bracket = createChampionship(entrants);
    this.publish();
  }
  acknowledge(socket: WebSocket, token: string): void {
    const id = this.peers.findIndex(p => p.socket === socket && p.connected);
    const m = currentMatches(this.bracket).find(m => matchToken(m) === token && m.status === 'ready' && m.slots.includes(id));
    if (!m || id < 0 || this.ready.has(id)) return;
    this.ready.add(id);
    if (m.slots.every(n => n !== null && this.ready.has(n))) {
      startBracketMatch(this.bracket, m.id);
      const players = m.slots as [number, number];
      const chars = players.map(n => this.peers[n].character), skins = players.map(n => this.peers[n].skin);
      const simulation = new GameSimulation(chars, false, this.stage, undefined, skins);
      simulation.step([0, 0]); simulation.step([0, 0]);
      this.duels.set(m.id, { simulation, players, token, inputs: [new Map(), new Map()], last: [1, 1], lastHash: [-1, -1], progress: [Date.now(), Date.now()] });
      players.forEach((n, seat) => { this.watchers.delete(n);this.ready.delete(n); this.awaiting.delete(n); this.send(this.peers[n].socket, { type: 'championship-start', stage: this.stage.id, matchId: token, seat, characters: chars, skins }); });
    }
    this.publish();
  }
  /** Only this duel's Player 1 can restart; other duels and prior results are untouched. */
  restart(socket:WebSocket,token?:string):void{
    const found=this.duelFor(socket,token);if(!found)return;
    const {id,duel,seat}=found;
    if(seat!==0||!duel.players.every(n=>this.peers[n].connected)||duel.simulation.state.phase==='result'){this.send(socket,{type:'restart-denied'});return;}
    const match=findMatch(this.bracket,id)!;
    match.attempt++;const nextToken=matchToken(match);
    const simulation=new GameSimulation(duel.players.map(n=>this.peers[n].character),false,this.stage,undefined,duel.players.map(n=>this.peers[n].skin));
    simulation.step([0,0]);simulation.step([0,0]);
    this.duels.set(id,{simulation,players:duel.players,token:nextToken,inputs:[new Map(),new Map()],last:[1,1],lastHash:[-1,-1],progress:[Date.now(),Date.now()]});
    duel.players.forEach((n,seat)=>this.send(this.peers[n].socket,{type:'fight-restarted',previousId:token,matchId:nextToken,seat,stage:this.stage.id,mode:'championship',bracket:this.bracket,state:{snapshot:encodeSnapshot(simulation.snapshot()),inputs:[[],[]],departures:[],nextInput:2}}));
    this.publish();
  }
  input(socket: WebSocket, token: string | undefined, frame: number, mask: number): void {
    const found = this.duelFor(socket, token);
    if (!found) return; // Late packets from an ended duel cannot affect the next match.
    const { duel, seat, id } = found;
    if (!Number.isInteger(frame) || frame < 2 || frame > 10_000_000 || !Number.isInteger(mask) || mask < 0 || mask > 2047) throw new Error('Invalid input');
    if (frame !== duel.last[seat] + 1 || frame > duel.last[1 - seat] + 120) throw new Error('Out-of-order input');
    duel.last[seat] = frame; duel.progress[seat] = Date.now(); duel.inputs[seat].set(frame, mask);
    this.send(this.peers[duel.players[1 - seat]].socket, { type: 'input', matchId: token, seat, frame, mask });
    for(const [id,watching] of this.watchers)if(watching===token&&this.peers[id].connected)this.send(this.peers[id].socket,{type:'input',matchId:token,seat,frame,mask});
    while (duel.inputs.every(queue => queue.has(duel.simulation.state.frame))) {
      const f = duel.simulation.state.frame;
      const stepStart=performance.now();
      duel.simulation.step(duel.inputs.map(queue => queue.get(f)!));
      stepMetrics.observe(performance.now()-stepStart);
      duel.inputs.forEach(queue => queue.delete(f));
      if(duel.simulation.state.frame%60===0){const frame=duel.simulation.state.frame,hash=hashState(duel.simulation.state);duel.players.forEach(id=>this.send(this.peers[id].socket,{type:'hash',matchId:token,seat:-1,frame,hash}));}
      if (duel.simulation.state.phase === 'result') {
        const winner = duel.simulation.state.winner;
        finishBracketMatch(this.bracket, id, winner < 0 ? null : duel.players[winner]);
        this.duels.delete(id); this.publish(); return;
      }
    }
  }
  watch(socket:WebSocket,token?:string):void{
    const id=this.peers.findIndex(p=>p.socket===socket&&p.connected);
    if(id<0||[...this.duels.values()].some(d=>d.players.includes(id)))return;
    const duel=[...this.duels.values()].find(d=>!token||d.token===token);if(!duel)return;
    this.watchers.set(id,duel.token);
    this.send(socket,{type:'spectate-start',matchId:duel.token,stage:this.stage.id,state:{snapshot:encodeSnapshot(duel.simulation.snapshot()),inputs:duel.inputs.map(q=>[...q]),departures:[],nextInput:0}});
  }
  private updateWatchers():void{
    for(const [id,token] of this.watchers)if(!this.peers[id]?.connected||![...this.duels.values()].some(d=>d.token===token))this.watchers.delete(id);
    if(this.bracket.complete){this.watchers.clear();return;}
    // Losing a bracket match permanently eliminates an entrant. Watch the next live duel automatically.
    this.peers.forEach((p,id)=>{if(p.connected&&!this.watchers.has(id)&&this.bracket.rounds.flat().some(m=>m.status==='complete'&&m.slots.includes(id)&&m.winner!==id))this.watch(p.socket);});
  }
  checkpoint(){return {bracket:structuredClone(this.bracket),completedAt:this.completedAt,ready:[...this.ready],awaiting:[...this.awaiting],duels:[...this.duels].map(([id,d])=>({id,players:d.players,token:d.token,snapshot:encodeSnapshot(d.simulation.snapshot()),inputs:d.inputs.map(q=>[...q]),last:d.last,lastHash:d.lastHash,progress:d.progress}))};}
  restoreCheckpoint(data:ReturnType<ChampionshipSession['checkpoint']>):void{
    this.bracket=data.bracket;this.completedAt=data.completedAt;this.ready=new Set(data.ready);this.awaiting=new Map(data.awaiting);this.duels.clear();
    for(const d of data.duels){const simulation=new GameSimulation(d.players.map(id=>this.peers[id].character),false,this.stage);simulation.restore(decodeSnapshot(d.snapshot));this.duels.set(d.id,{simulation,players:d.players,token:d.token,inputs:d.inputs.map(q=>new Map(q)) as Duel['inputs'],last:d.last,lastHash:d.lastHash,progress:d.progress});}
  }
  recovery(socket:WebSocket){
    const id=this.peers.findIndex(p=>p.socket===socket);
    for(const duel of this.duels.values()){
      const seat=duel.players.indexOf(id);if(seat<0)continue;
      return {seat,matchId:duel.token,state:{snapshot:encodeSnapshot(duel.simulation.snapshot()),inputs:duel.inputs.map(q=>[...q]),departures:[] as [number,number][],nextInput:duel.last[seat]+1}};
    }
    return {seat:id};
  }
  neutralDisconnected(now=Date.now()):void{
    for(const [duelId,duel] of [...this.duels])duel.players.forEach((id,seat)=>{
      const peer=this.peers[id],other=this.peers[duel.players[1-seat]];
      if(!peer.reconnectUntil)return;
      const clock=peer.neutralClock??now,steps=Math.min(120,Math.max(0,Math.floor((now-clock)*60/1000)));
      const target=other.connected?duel.last[1-seat]:duel.last[seat]+steps;
      peer.neutralClock=other.connected?now:clock+steps*1000/60;
      for(let n=0;this.duels.get(duelId)===duel&&duel.last[seat]<target&&n<120;n++)this.input(peer.socket,duel.token,duel.last[seat]+1,0);
    });
  }
  hash(socket: WebSocket, token: string | undefined, frame: number, hash: string): void {
    const found = this.duelFor(socket, token);
    if (!found || !Number.isInteger(frame) || frame < 0 || frame > found.duel.last[found.seat] || frame <= found.duel.lastHash[found.seat] || frame % 60 !== 0 || !/^[a-f0-9]{1,8}$/.test(hash)) return;
    found.duel.lastHash[found.seat] = frame;
    // Never forward peer checksum claims; server-settled hashes are sent above.
  }
  leave(socket: WebSocket): void {
    const id = this.peers.findIndex(p => p.socket === socket);
    this.ready.delete(id); this.awaiting.delete(id); withdrawEntrant(this.bracket, id);
    for (const [key] of this.duels) if (findMatch(this.bracket, key)?.status !== 'playing') this.duels.delete(key);
    this.publish();
  }
  /** Waiting spectators never time out. Only unready or input-stalling contestants forfeit. */
  expired(now: number): WebSocket[] {
    const expired = new Set<number>();
    for (const [id, since] of this.awaiting) if (!this.ready.has(id) && !this.peers[id].reconnectUntil && now - since >= 120_000) expired.add(id);
    for (const duel of this.duels.values()) {
      const min = Math.min(...duel.last);
      duel.players.forEach((id, seat) => { if (!this.peers[id].reconnectUntil && duel.last[seat] === min && now - duel.progress[seat] >= (min === 1 ? 120_000 : 60_000)) expired.add(id); });
    }
    return [...expired].map(id => this.peers[id].socket);
  }
  private duelFor(socket: WebSocket, token: string | undefined) {
    for (const [id, duel] of this.duels) {
      const seat = duel.players.findIndex(n => this.peers[n].socket === socket && (this.peers[n].connected||this.peers[n].reconnectUntil!==undefined));
      if (duel.token === token && seat >= 0) return { id, duel, seat };
    }
  }
  private publish(): void {
    if(this.bracket.complete)this.completedAt??=Date.now();
    const waiting = new Set(currentMatches(this.bracket).filter(m => m.status === 'ready').flatMap(m => m.slots).filter((id): id is number => id !== null));
    for (const id of this.awaiting.keys()) if (!waiting.has(id)) this.awaiting.delete(id);
    for (const id of waiting) if (!this.awaiting.has(id)) this.awaiting.set(id, Date.now());
    for (const id of this.ready) if (!waiting.has(id)) this.ready.delete(id);
    this.peers.filter(p => p.connected).forEach(p => this.send(p.socket, { type: 'championship', bracket: this.bracket, ready: [...this.ready] }));
    this.updateWatchers();
  }
}
