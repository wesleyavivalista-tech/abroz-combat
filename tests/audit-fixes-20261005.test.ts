import test from 'node:test';
import assert from 'node:assert/strict';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {resolveHit} from '../packages/game-core/combat/CombatSystem.js';
import {activateStructure} from '../packages/game-core/simulation/StructureSystem.js';
import {LobbyClient} from '../apps/client/src/network.js';
import {RoomService,RESULT_RETENTION_MS} from '../apps/server/src/rooms.js';
import {RollbackManager} from '../packages/networking/RollbackManager.js';
import {Button} from '../packages/game-core/types.js';
import type {WebSocket} from 'ws';

for(const field of ['loanStunUntil','nikalzStunUntil'] as const)test(`${field} expiry preserves a newer hit through hitstop and replay`,()=>{
 const sim=new GameSimulation(['luizinho','gut']);sim.state.phase='fight';sim.state.frame=100;
 const target=sim.state.fighters[1];target[field]=101;target.stun=1;target.state='HitStunStanding';
 resolveHit(sim.state,sim.stage,()=>{},0,characters.luizinho.moves.jab,0,false);
 const before=target.stun;const replay=new GameSimulation(['luizinho','gut']);replay.restore(sim.snapshot());
 sim.step([0,0]);replay.step([0,0]);assert.equal(target.stun,before);assert.equal(hashState(sim.state),hashState(replay.state));
 for(let i=0;i<60;i++)sim.step([0,0]);assert.equal(target.stun,0);assert.equal(target[field],undefined);
 sim.resetPositions();assert.equal(sim.state.fighters[1].timedHitReaction,undefined);
});
test('slowed beam emits once per crossed interval and replays exactly',()=>{
 const sim=new GameSimulation(['drupa','gut']);sim.state.phase='fight';
 const [source,target]=sim.state.fighters;Object.assign(source,{x:700,y:0,facing:1,move:'budaBeam',moveFrame:39,speedRemainder:0,bloodSlowUntil:1000,beamAim:0,state:'SpecialMove'});target.x=1000;
 const hp=target.health;sim.step([0,0]);sim.step([0,0]);assert.equal(hp-target.health,18);
 const replay=new GameSimulation(['drupa','gut']);replay.restore(sim.snapshot());
 sim.step([0,0]);replay.step([0,0]);assert.equal(hp-target.health,18);assert.equal(hashState(sim.state),hashState(replay.state));
 for(let i=0;i<23;i++)sim.step([0,0]);assert.equal(hp-target.health,36);
});
for(const side of [-1,1] as const)test(`edge wall ejects inside the arena (${side})`,()=>{
 const sim=new GameSimulation(['luizinho','gut']);sim.state.phase='fight';
 const [builder,target]=sim.state.fighters;builder.x=side<0?185:sim.stage.width-185;builder.facing=side;target.x=side<0?40:sim.stage.width-40;
 activateStructure(sim.state,sim.stage,builder,0,characters.luizinho.moves.wall);const wall=sim.state.structures![0];
 for(let i=0;i<10;i++){sim.step([0,0]);assert.ok(target.x>=40&&target.x<=sim.stage.width-40);assert.ok(target.x+31<=wall.x-25||target.x-31>=wall.x+25);}
});
class Socket{static OPEN=1;readyState=1;bufferedAmount=0;sent:string[]=[];send(data:string){this.sent.push(data);}close(){this.readyState=3;}terminate(){this.close();}}
test('switching delay to zero preserves FIFO and disconnect cancels queued inputs',async()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'WebSocket');Object.defineProperty(globalThis,'WebSocket',{value:Socket,configurable:true});
 const client=new LobbyClient(),socket=new Socket();client.socket=socket as unknown as globalThis.WebSocket;
 try{client.latency=20;client.send({type:'input',frame:2,mask:0});client.latency=0;client.send({type:'input',frame:3,mask:0});await new Promise(resolve=>setTimeout(resolve,50));
 assert.deepEqual(socket.sent.map(s=>JSON.parse(s).frame),[2,3]);client.latency=20;client.send({type:'input',frame:4,mask:0});client.disconnect();await new Promise(resolve=>setTimeout(resolve,40));assert.equal(socket.sent.length,2);
 }finally{client.disconnect();if(original)Object.defineProperty(globalThis,'WebSocket',original);else Reflect.deleteProperty(globalThis,'WebSocket');}
});
test('completed championships retain results briefly then release room and membership',()=>{
 const rooms=new RoomService(),a=new Socket(),b=new Socket();const sa=a as unknown as WebSocket,sb=b as unknown as WebSocket;
 rooms.create(sa,'drupa',2,'championship');const room=[...rooms.rooms.values()][0];rooms.join(sb,room.code,'gut');rooms.ready(sa);rooms.ready(sb);rooms.leave(sb);
 assert.equal(room.championship!.bracket.complete,true);const completed=room.championship!.completedAt!;
 rooms.expireInactive(completed+RESULT_RETENTION_MS-1);assert.equal(rooms.rooms.size,1);
 rooms.expireInactive(completed+RESULT_RETENTION_MS);assert.equal(rooms.rooms.size,0);assert.equal(rooms.membership.size,0);assert.equal(a.readyState,3);
});
test('online impact journal waits for confirmation, survives replay and drains once',()=>{
 const sim=new GameSimulation(['luizinho','gut']);sim.state.phase='fight';const [a,b]=sim.state.fighters;
 a.x=1000;b.x=1100;a.move='jab';a.moveFrame=7;a.facing=1;a.state='StandingAttack';const hp=b.health;
 const net=new RollbackManager(sim,0,0);net.schedule(0,()=>{});net.tick();assert.ok(b.health<hp);assert.equal(net.drainConfirmedImpacts().length,0);
 // Late guard overturns the unblocked prediction; only corrected chip is delivered.
 net.receive(0,Button.Right,1);const damage=net.drainConfirmedImpacts();assert.ok(damage.length>0);assert.ok(damage.every(e=>e.blocked));assert.deepEqual(net.drainConfirmedImpacts(),[]);
});
test('one expired lock cannot cancel another active ability lock',()=>{
 const sim=new GameSimulation(['luizinho','gut']);sim.state.phase='fight';sim.state.frame=100;const d=sim.state.fighters[1];
 d.loanStunUntil=110;d.nikalzStunUntil=101;d.stun=10;d.state='HitStunStanding';sim.step([0,0]);assert.ok(d.stun>0);
 for(let i=0;i<12;i++)sim.step([0,0]);assert.equal(d.stun,0);assert.equal(d.timedHitReaction,undefined);
});
test('five-hit escape releases loan reaction without cancelling its later repayment',()=>{
 const sim=new GameSimulation(['luizinho','gut']);sim.state.phase='fight';const d=sim.state.fighters[1];d.loanUntil=1800;d.loanStunUntil=120;d.stun=120;d.state='HitStunStanding';d.consecutiveHits=4;d.lastStunHitFrame=0;
 resolveHit(sim.state,sim.stage,()=>{},0,characters.luizinho.moves.jab,0,false);assert.equal(d.loanStunUntil,undefined);assert.equal(d.loanUntil,1800);sim.step([0,0]);assert.equal(d.stun,0);
});
test('boosted beam does not skip a pulse between sampled animation frames',()=>{
 const sim=new GameSimulation(['drupa','gut']);sim.state.phase='fight';const [f,d]=sim.state.fighters;
 Object.assign(f,{x:700,y:0,facing:1,move:'budaBeam',moveFrame:51,speedRemainder:99,weaponUntil:1000,beamAim:0,state:'SpecialMove',beamPulse:{serial:f.attackSerial,move:'budaBeam',index:0}});d.x=1000;
 const hp=d.health;sim.step([0,0]);assert.ok(f.moveFrame>=52);assert.ok(d.health<hp);
});
test('KO and reset remove new reaction and pulse state',()=>{
 const sim=new GameSimulation(['drupa','gut']);sim.state.phase='fight';const f=sim.state.fighters[0];f.timedHitReaction=30;f.beamPulse={serial:1,move:'budaBeam',index:1};f.health=0;sim.step([0,0]);assert.equal(f.timedHitReaction,undefined);assert.equal(f.beamPulse,undefined);
 sim.resetPositions();assert.equal(sim.state.fighters[0].beamPulse,undefined);
});
