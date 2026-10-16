import {randomArena} from '../../../../packages/game-core/stages/random.js';
import {randomInt} from 'node:crypto';
import type {WebSocket} from 'ws';
import type {ChampionshipStore} from './store.js';
import {VerifiedMatch} from '../verifiedMatch.js';
import {GameSimulation} from '../../../../packages/game-core/simulation/GameSimulation.js';
import {stages} from '../../../../packages/game-core/stages/registry.js';
import type {ServerMessage} from '../../../../packages/shared/protocol.js';
import type {PersistentCommand,PersistentLobby} from '../../../../packages/shared/persistentChampionship.js';
interface Claim {socket:WebSocket;session:string;ready:boolean;last:number;progress:number}
interface Lobby {id:string;seriesId:string;claims:(Claim|null)[];attempt?:string;match?:VerifiedMatch;stage?:string}
/** Temporary connections never become tournament competitors. All result writes originate here. */
export class PersistentChampionshipService {
 private lobbies=new Map<string,Lobby>();
 private viewers=new Map<WebSocket,string>();
 private membership=new Map<WebSocket,Lobby>();
 private budgets=new Map<string,{time:number;count:number}>();
 constructor(readonly store:ChampionshipStore,private send:(s:WebSocket,m:ServerMessage)=>void){}
 has(socket:WebSocket){return this.membership.has(socket);}
 watching(socket:WebSocket){return this.viewers.has(socket);}
 private limit(address:string){const now=Date.now();let b=this.budgets.get(address);if(!b||now-b.time>60000){b={time:now,count:0};this.budgets.set(address,b);}if(++b.count>5)throw Error('Please wait before creating or managing another championship');}
 command(socket:WebSocket,m:PersistentCommand,address:string):void{
  switch(m.action){
   case 'list':{const result=this.store.list(m.completed,m.offset);for(const card of result.cards)card.available-=Array.from(this.lobbies.values()).filter(l=>l.id===card.id&&(l.attempt||l.claims.every(Boolean))).length;this.viewers.delete(socket);this.send(socket,{type:'persistent-list',...result});break;}
   case 'create':{this.limit(address);const result=this.store.create(m.config);this.viewers.set(socket,result.tournament.id);this.send(socket,{type:'persistent-created',...result});break;}
   case 'open':this.store.get(m.id);this.viewers.set(socket,m.id);this.detail(socket,m.id);break;
   case 'claim':this.claim(socket,m);break;
   case 'ready':{const lobby=this.membership.get(socket);if(!lobby||lobby.attempt)throw Error('No available fighter claimed');const c=lobby.claims.find(c=>c?.socket===socket)!;c.ready=m.ready===true;c.progress=Date.now();if(lobby.claims.every(c=>c?.ready))this.start(lobby);this.publish(lobby.id);break;}
   case 'leave':this.leave(socket);break;
   case 'delete':{this.limit(address);if([...this.lobbies.values()].some(l=>l.id===m.id&&l.attempt))throw Error('Wait for active fights to finish before deleting this championship');this.store.remove(m.id,m.pin);for(const l of [...this.lobbies.values()])if(l.id===m.id)this.clear(l);for(const [s,id] of this.viewers)if(id===m.id){this.send(s,{type:'persistent-deleted',id});this.viewers.delete(s);}break;}
   default:throw Error('Unknown championship action');
  }
 }
 private claim(socket:WebSocket,m:Extract<PersistentCommand,{action:'claim'}>){
  if(this.membership.has(socket))throw Error('Leave your current fighter slot first');
  if(typeof m.session!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(m.session))throw Error('Invalid temporary session');
  if([...this.membership.values()].some(l=>l.claims.some(c=>c?.session===m.session)))throw Error('This game client already controls a fighter');
  const t=this.store.get(m.id),series=t.series.find(s=>s.id===m.seriesId);if(!series||series.status!=='available'||t.completedAt)throw Error('Series is not available');
  const count=t.competitors[0].fighters.length*2;if(!Number.isInteger(m.slot)||m.slot<0||m.slot>=count)throw Error('Invalid fighter slot');
  let lobby=this.lobbies.get(m.seriesId);if(!lobby){if(this.lobbies.size>=32)throw Error('All championship lobbies are busy');lobby={id:t.id,seriesId:series.id,claims:Array(count).fill(null)};this.lobbies.set(series.id,lobby);}
  if(lobby.attempt||lobby.claims[m.slot])throw Error('This fighter is already claimed');
  lobby.claims.forEach(c=>{if(c)c.ready=false;});lobby.claims[m.slot]={socket,session:m.session,ready:false,last:1,progress:Date.now()};this.membership.set(socket,lobby);this.viewers.set(socket,t.id);this.publish(t.id);
 }
 private start(l:Lobby){
  if(l.attempt||!l.claims.every(c=>c?.ready))return;
  if([...this.lobbies.values()].filter(l=>l.attempt).length>=8)throw Error('All championship fight servers are busy. Ready again shortly.');
  const t=this.store.get(l.id),s=t.series.find(s=>s.id===l.seriesId)!,sides=s.sides.map(id=>t.competitors.find(c=>c.id===id)!);
  const characters=sides.flatMap(c=>c.fighters),skins=sides.flatMap(c=>c.skins),teams=sides.flatMap((c,i)=>c.fighters.map(()=>i)),seed=randomInt(0x100000000);
  const stage=randomArena(l.stage??t.stage);l.stage=stage;
  const match=new VerifiedMatch(new GameSimulation(characters,false,stages[stage],teams,skins,false,seed),(frame,hash)=>l.claims.forEach(c=>c&&this.send(c.socket,{type:'hash',matchId:l.attempt,seat:-1,frame,hash})));
  l.attempt=this.store.begin(t.id,s.id);l.match=match;
  l.claims.forEach((c,seat)=>{c!.last=1;c!.progress=Date.now();this.send(c!.socket,{type:'persistent-start',matchId:l.attempt!,seat,characters,skins,teams,stage,seed});});
 }
 input(socket:WebSocket,frame:number,mask:number,attempt?:string){
  const l=this.membership.get(socket);if(!l?.match||l.attempt!==attempt)return;const seat=l.claims.findIndex(c=>c?.socket===socket),c=l.claims[seat]!;
  if(!Number.isInteger(frame)||frame!==c.last+1||frame>10_000_000||frame>Math.min(...l.claims.map(c=>c!.last))+120||!Number.isInteger(mask)||mask<0||mask>2047)throw Error('Invalid championship input');
  c.last=frame;c.progress=Date.now();l.claims.forEach((other,i)=>{if(other&&i!==seat)this.send(other.socket,{type:'input',matchId:attempt,seat,frame,mask});});
  l.match.receive(seat,frame,mask);const state=l.match.simulation.state;
  if(state.phase==='result'){
   if(state.winner<0){this.end(l,true,'Draw — replay this fight.');return;}
   // The server's own simulation supplies both winner and statistics; never a client result.
   this.store.finalize(l.attempt!,state.teams[state.winner],state.statistics!);
   this.end(l,false,'Fight saved. Ready again to continue the series.');
  }
 }
 private end(l:Lobby,cancelled:boolean,message:string){const attempt=l.attempt!;if(cancelled)this.store.cancel(attempt);l.attempt=undefined;l.match=undefined;l.claims.forEach(c=>{if(c){c.ready=false;c.last=1;c.progress=Date.now();this.send(c.socket,{type:'persistent-ended',id:l.id,seriesId:l.seriesId,matchId:attempt,cancelled,message});}});const t=this.store.get(l.id);if(t.series.find(s=>s.id===l.seriesId)?.status==='completed')this.clear(l);this.publish(l.id);}
 private clear(l:Lobby){l.claims.forEach(c=>{if(c)this.membership.delete(c.socket);});this.lobbies.delete(l.seriesId);}
 leave(socket:WebSocket){this.viewers.delete(socket);const l=this.membership.get(socket);if(!l)return;if(l.attempt)this.end(l,true,'Fight interrupted. Previously saved wins are preserved.');this.membership.delete(socket);l.claims=l.claims.map(c=>c?.socket===socket?null:c);l.claims.forEach(c=>{if(c)c.ready=false;});if(!l.claims.some(Boolean))this.clear(l);this.publish(l.id);}
 expire(now=Date.now()){for(const [address,b] of this.budgets)if(now-b.time>60000)this.budgets.delete(address);for(const l of [...this.lobbies.values()])for(const c of l.claims)if(c&&now-c.progress>(l.attempt?(c.last===1?120000:60000):600000)){this.leave(c.socket);this.send(c.socket,{type:'error',message:'Inactive championship slot released'});}}
 private detail(socket:WebSocket,id:string){const t=this.store.get(id),lobbies:PersistentLobby[]=t.series.filter(s=>s.status==='available').map(s=>{const l=this.lobbies.get(s.id);return {seriesId:s.id,seat:l?.claims.findIndex(c=>c?.socket===socket)??-1,attempt:l?.attempt,slots:s.sides.flatMap((id,team)=>{const c=t.competitors.find(c=>c.id===id)!;return c.fighters.map((fighter,i)=>{const claim=l?.claims[team*c.fighters.length+i];return {fighter,skin:c.skins[i],team,occupied:!!claim,ready:!!claim?.ready};});})};});this.send(socket,{type:'persistent-detail',tournament:t,lobbies});}
 private publish(id:string){for(const [s,view] of this.viewers)if(view===id)this.detail(s,id);}
 shutdown(){for(const l of this.lobbies.values())if(l.attempt)this.store.cancel(l.attempt);this.store.close();}
}
