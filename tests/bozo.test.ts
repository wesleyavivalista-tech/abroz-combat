import "./fixtures/legacy-roster.js";
import {test} from "node:test";
import assert from "node:assert/strict";
import {GameSimulation,hashState} from "../packages/game-core/simulation/GameSimulation.js";
import {characters} from "../packages/game-core/characters/registry.js";
import {Button} from "../packages/game-core/types.js";
import {summonClones} from "../packages/game-core/simulation/HairSystem.js";
import {igniteTarget} from "../packages/game-core/simulation/StatusSystem.js";
import {RollbackManager} from "../packages/networking/RollbackManager.js";
const m=characters.bozo.moves;
function match(n=2){const s=new GameSimulation(Array(n).fill('bozo'),false,undefined,n===2?[0,1]:Array.from({length:n},(_,i)=>i%2));s.state.phase='fight';s.state.fighters.forEach(f=>f.state='Idle');return s;}
function run(s:GameSimulation,n:number,input=0){for(let i=0;i<n;i++)s.step([input,0,0,0,0,0]);}
test('Bozo basic chain ends in beard lash; heavy and kick are separate single moves',()=>{
 const s=match(),f=s.state.fighters[0];s.step([Button.Light,0]);run(s,3);s.step([Button.Light,0]);run(s,10);assert.equal(f.move,'cross');s.step([Button.Light,0]);run(s,14);assert.equal(f.move,'beard');run(s,60);s.step([Button.Medium,0]);assert.equal(f.move,'heavy');run(s,60);s.step([Button.Heavy,0]);assert.equal(f.move,'kick');
});
test('hair grip freezes movement and attacks for 180 ticks while allowing further damage',()=>{
 const s=match(),d=s.state.fighters[0];const initialHealth=d.health;s.hit(1,m.grip,0,false,0);assert.equal(d.health,initialHealth);const [x,y]=[d.x,d.y],expiry=d.trappedUntil;assert.equal(expiry-s.state.frame,180);s.state.hitstop=0;
 run(s,30,Button.Right|Button.Up|Button.Light);assert.equal(d.x,x);assert.equal(d.y,y);assert.equal(d.move,null);
 const hp=d.health;s.hit(1,m.heavy,Button.Left,false,0);assert.ok(d.health<hp);assert.equal(d.trappedUntil,expiry);assert.equal(d.vy,0);assert.equal(d.y,y);
 run(s,expiry-s.state.frame-1,Button.Right);assert.equal(d.x,x);s.state.hitstop=0;run(s,1,Button.Right);assert.ok(d.x>x);
});
test('grip projectile traps on contact but respects guard, allies and spawn invulnerability',()=>{
 const s=match(),[a,b]=s.state.fighters;a.x=600;b.x=900;const hp=b.health;s.step([Button.Special2,0]);run(s,50);assert.ok(b.trappedUntil>s.state.frame);assert.equal(b.health,hp);
 for(const mode of ['block','immune','ally']){const t=match(mode==='ally'?4:2),d=t.state.fighters[mode==='ally'?2:1];if(mode==='immune')d.invulnerableUntil=100;const hp=d.health;t.hit(0,m.grip,mode==='block'?Button.Right:0,false,mode==='ally'?2:1);assert.equal(d.trappedUntil,0);assert.equal(d.health,hp);}
});
test('hair armor lasts 1320 ticks and reduces melee, burn and ground hazards by 90%',()=>{
 const s=match(),a=s.state.fighters[0];a.meter=100;s.step([Button.Super1,0]);run(s,24);assert.equal(a.armorUntil-s.state.frame,1320);
 const hp=a.health;s.hit(1,{...m.kick,damage:100},0,false,0);assert.equal(hp-a.health,10);
 igniteTarget(s.state,a,1,30,10);s.state.hitstop=1000;const before=a.health;run(s,30);assert.equal(before-a.health,1);
 const expiry=a.armorUntil;run(s,expiry-s.state.frame);assert.equal(a.armorUntil,0);
 const h=new GameSimulation(['bozo','tocha']);h.state.phase='fight';h.state.fighters.forEach(f=>f.state='Idle');const target=h.state.fighters[0];target.armorUntil=100;h.state.hazards=[{owner:1,x:target.x,y:0,move:'pentagram',expiresAt:100,nextTicks:[0,0]}];h.step([0,0]);assert.equal(target.health,1448);
});
test('three one-life clones pursue enemies, use basic attacks, die permanently and do not become seats',()=>{
 const s=match(),a=s.state.fighters[0];a.meter=100;s.step([Button.Super2,0]);run(s,36);assert.equal(s.state.clones.length,3);assert.equal(s.state.fighters.length,2);
 assert.ok(s.state.clones.every(c=>c.fighter.health===423&&c.fighter.lives===1));const old=s.state.clones.map(c=>c.fighter.x);run(s,90);assert.ok(s.state.clones.some((c,i)=>c.fighter.x!==old[i]));assert.ok(s.state.fighters[1].health<1450);
 const dead=s.state.clones[0],before=dead.fighter.health;s.hit(1,m.kick,0,false,0,1,s.state.fighters[1],dead.fighter);assert.ok(dead.fighter.health<before);dead.fighter.health=0;run(s,1);assert.ok(!s.state.clones.some(c=>c.id===dead.id));run(s,150);assert.ok(!s.state.clones.some(c=>c.id===dead.id));assert.equal(a.lives,3);
});
test('clone damage is not protected by training immortality, and reset clears companions',()=>{
 const s=new GameSimulation(['bozo','prototype-a'],true);summonClones(s.state,0,s.stage);const c=s.state.clones[0];s.hit(1,{...m.kick,damage:9999},0,false,0,1,s.state.fighters[1],c.fighter);assert.equal(c.fighter.health,0);s.step([0,0]);assert.equal(s.state.clones.length,2);s.resetPositions();assert.equal(s.state.clones.length,0);
});
test('both supers require full meter, cannot repeat, and life loss clears armor, preserves summons, and forfeit clears them',()=>{
 for(const key of [Button.Super1,Button.Super2]){const s=match(),f=s.state.fighters[0];f.meter=99;s.step([key,0]);assert.equal(f.move,null);run(s,15);f.meter=100;s.step([key,0]);run(s,80);const id=key===Button.Super1?'armor':'clones';assert.deepEqual(f.usedSupers,[id]);f.meter=100;s.step([key,0]);assert.equal(f.move,null);f.health=0;run(s,1);assert.equal(f.armorUntil,0);assert.equal(s.state.clones.length,key===Button.Super2?3:0);run(s,120);assert.deepEqual(f.usedSupers,[id]);}
 const s=match(4);summonClones(s.state,0,s.stage);s.step([0,0,0,0],[0]);assert.equal(s.state.clones.length,0);assert.equal(s.state.phase,'fight');
});
test('Bozo clone, armor and grip inputs converge after online rollback in 2v2 and 3v3',()=>{
 for(const n of [4,6]){const a=match(n),b=match(n);for(const s of [a,b])s.state.fighters.forEach((f,i)=>{f.x=500+i*100;f.meter=100;});const rb=new RollbackManager(b,0,0,8);
 for(let frame=0;frame<280;frame++){const masks=Array.from({length:n},(_,seat)=>frame===0?(seat%2?Button.Super1:Button.Super2):frame===100?Button.Special2:frame===180?Button.Special:0);a.step(masks);rb.local.set(frame,masks[0]);rb.tick();for(let seat=1;seat<n;seat++)rb.receive(frame,masks[seat],seat);}
 assert.equal(hashState(a.state),hashState(b.state));assert.ok(a.state.clones.length>0);}
});
test('clones respect allies, can burn and be trapped, and cannot keep an eliminated team alive',()=>{
 const s=match(4);summonClones(s.state,0,s.stage);const c=s.state.clones[0],hp=c.fighter.health;
 s.hit(2,m.heavy,0,false,0,1,s.state.fighters[2],c.fighter);assert.equal(c.fighter.health,hp);
 s.hit(1,m.grip,0,false,0,1,s.state.fighters[1],c.fighter);assert.equal(c.fighter.trappedUntil,180);
 igniteTarget(s.state,c.fighter,1,30,10);s.state.hitstop=50;run(s,30);assert.ok(c.fighter.health<hp-m.grip.damage);
 s.step([0,0,0,0],[0,2]);assert.equal(s.state.phase,'result');assert.equal(s.state.clones.length,0);assert.equal(s.state.teams[s.state.winner],1);
});

test('clone contacts damage and stun only their target without freezing unrelated players',()=>{
 const s=match(4);summonClones(s.state,0,s.stage);
 const clone=s.state.clones[0].fighter,target=s.state.fighters[1],bystander=s.state.fighters[2];
 bystander.x=1800;const x=bystander.x;
 const hp=target.health;
 s.hit(0,m.heavy,0,false,1,1,clone,target);
 assert.ok(target.health<hp);assert.ok(target.stun>0);assert.equal(s.state.hitstop,0);
 assert.ok(s.events.every(e=>e.power<3),'clone contacts do not shake the whole screen');
 s.step([0,0,Button.Right,0]);assert.ok(bystander.x>x,'other players move on the very next tick');
 target.move=null;target.stun=0;target.state='Idle';target.y=0;target.vy=0;target.facing=-1;
 s.hit(0,m.jab,Button.Right,false,1,1,clone,target);
 assert.equal(target.state,'BlockStanding');assert.equal(s.state.hitstop,0);
 s.hit(1,m.jab,0,false,0,-1,target,clone);assert.equal(s.state.hitstop,0,'hitting a clone also stays local');
 s.hit(0,m.jab,0,false,1,1,s.state.fighters[0],target);
 assert.ok(s.state.hitstop>0,'normal fighter impacts retain hit-stop');
});

test('a six-player clone swarm never starts global hit-stop during sustained AI combat',()=>{
 const s=match(6);s.state.fighters.forEach((f,i)=>{f.x=400+i*230;f.health=100000;});
 for(let i=0;i<6;i++)summonClones(s.state,i,s.stage);
 let damageEvents=0;
 for(let tick=0;tick<240;tick++){
  s.step([0,0,0,0,0,0]);assert.equal(s.state.hitstop,0);
  damageEvents+=s.events.length;
 }
 assert.ok(damageEvents>5,'AI companions actually exchanged hits');
 assert.ok(s.state.fighters.some(f=>f.health<100000));
});

test('Hair Grip reaches beyond its former range at the same speed and still expires',()=>{
 const s=match();s.state.fighters[0].x=400;s.state.fighters[1].x=1200;
 s.step([Button.Special2,0]);run(s,100);
 assert.ok(s.state.fighters[1].trappedUntil>s.state.frame,'grip reaches a target 800 units away');
 assert.equal(m.grip.projectile?.speed,11);
 const far=match();far.state.fighters[0].x=400;far.state.fighters[1].x=1500;
 far.step([Button.Special2,0]);run(far,110);
 assert.equal(far.state.fighters[1].trappedUntil,0);
 assert.ok(far.state.projectiles.every(p=>!p.active));
});

test('Body hair doubles outer reach in either direction, without a projectile',()=>{
 for(const facing of [1,-1] as const)for(const distance of [620,730,1280,1400]){
  const s=match(),[a,b]=s.state.fighters;a.x=facing===1?350:1950;b.x=a.x+facing*distance;a.facing=facing;b.facing=facing===1?-1:1;
  const hp=b.health;s.step([Button.Special,0]);run(s,32);
  assert.equal(b.health<hp,distance<1400);
  assert.ok(s.state.projectiles.every(p=>!p.active));
 }
});
