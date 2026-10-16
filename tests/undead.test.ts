import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeProjectile} from '../packages/game-core/simulation/ProjectilePool.js';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {stages} from '../packages/game-core/stages/registry.js';
import {FINAL_DEATH_FRAMES,FINAL_DEATH_SPEED,GRAVE_HP,ZOMBIE_RISE_FRAMES,ZOMBIE_DEATH_FRAMES,matchTimeScale,ZOMBIE_CLAW,advanceUndead} from '../packages/game-core/simulation/UndeadSystem.js';
import {clearCombatEntities} from '../packages/game-core/simulation/CombatLifecycle.js';
import {RollbackManager} from '../packages/networking/RollbackManager.js';
import {Button,type StageDefinition} from '../packages/game-core/types.js';
import {resolveHit} from '../packages/game-core/combat/CombatSystem.js';
import {GameAudio} from '../apps/client/src/audio/GameAudio.js';
import type {AudioManager} from '../apps/client/src/audio/AudioManager.js';
const run=(g:GameSimulation,n:number)=>{for(let i=0;i<n;i++)g.step(g.state.fighters.map(()=>0));};
const game=(ids=['nikalz','jopa','gut','drupa'],stage?:StageDefinition,teams?:number[])=>{
 const g=new GameSimulation(ids,false,stage,teams);g.state.phase='fight';g.state.fighters.forEach(f=>{f.state='Idle';f.invulnerableUntil=0;});return g;
};
function kill(g:GameSimulation,seats=[0]){for(const seat of seats){g.state.fighters[seat].lives=1;g.state.fighters[seat].health=0;}g.step(g.state.fighters.map(()=>0));}
function grave(g:GameSimulation){kill(g);run(g,FINAL_DEATH_FRAMES);const c=g.state.clones.find(c=>c.undead)!;assert.ok(c);return c;}
function zombie(g:GameSimulation){const c=grave(g);c.fighter.health=0;run(g,ZOMBIE_RISE_FRAMES+1);assert.equal(c.fighter.undead,'zombie');return c;}

test('final life creates one grave only after cinematic, exactly at the death position',()=>{
 const g=game(),f=g.state.fighters[0];f.x=870;f.y=215;
 kill(g);assert.equal(matchTimeScale(g.state),FINAL_DEATH_SPEED);assert.equal(g.state.clones.length,0);
 run(g,FINAL_DEATH_FRAMES-1);assert.equal(g.state.clones.length,0);run(g,1);
 const c=g.state.clones[0];assert.equal(matchTimeScale(g.state),1);assert.equal(c.fighter.health,GRAVE_HP);assert.deepEqual([c.fighter.x,c.fighter.y],[870,215]);
 run(g,80);assert.equal(g.state.clones.length,1);assert.equal(g.state.fighters[0].lives,0);
});
test('ordinary lost lives and forfeits never create graves or cinematics',()=>{
 const g=game();g.state.fighters[0].health=0;run(g,1);assert.equal(g.state.finalDeaths,undefined);run(g,125);assert.equal(g.state.clones.length,0);assert.equal(g.state.fighters[0].lives,2);
 g.step([0,0,0,0],[1]);assert.equal(g.state.finalDeaths,undefined);run(g,40);assert.equal(g.state.clones.length,0);
});
test('1v1 ends normally with a final death cinematic and never a grave',()=>{
 const g=game(['nikalz','jopa']);kill(g);assert.equal(g.state.phase,'result');assert.equal(g.state.winner,1);assert.equal(matchTimeScale(g.state),FINAL_DEATH_SPEED);run(g,FINAL_DEATH_FRAMES);assert.equal(matchTimeScale(g.state),1);assert.equal(g.state.clones.length,0);
});
test('simultaneous eliminations and graves remain independent; zombies never count toward victory',()=>{
 const g=game();kill(g,[0,1]);assert.equal(g.state.finalDeaths?.length,2);run(g,FINAL_DEATH_FRAMES);assert.equal(g.state.clones.length,2);
 for(const c of g.state.clones)c.fighter.health=0;run(g,ZOMBIE_RISE_FRAMES+1);assert.ok(g.state.clones.every(c=>c.fighter.undead==='zombie'));
 kill(g,[2]);assert.equal(g.state.phase,'result');assert.equal(g.state.winner,3);assert.equal(g.state.clones.length,0);
 const tie=game(['nikalz','jopa']);kill(tie,[0,1]);assert.equal(tie.state.winner,-1);assert.equal(tie.state.finalDeaths?.length,2);
});
for(const id of Object.keys(characters))test(`${id}: zombie preserves max HP, is AI only and dies without another grave`,()=>{
 const g=game([id,'jopa','gut','drupa']),c=zombie(g);assert.equal(c.fighter.health,characters[id].stats.maxHealth);assert.equal(c.fighter.lives,1);assert.equal(c.fighter.characterId,id);
 g.step([Button.Super1|Button.Super2,0,0,0]);assert.equal(c.fighter.move,null);assert.equal(g.state.fighters[0].lives,0);
 c.fighter.health=0;run(g,1);assert.equal(c.fighter.undead,'dying');run(g,ZOMBIE_DEATH_FRAMES);assert.equal(g.state.clones.length,0);assert.equal(g.state.finalDeaths,undefined);
});
test('former teammates can damage graves and zombies, and claws poison former teammates',()=>{
 const g=game(undefined,undefined,[0,0,1,1]),c=grave(g),ally=g.state.fighters[1];
 g.hit(1,characters.jopa.moves[Object.keys(characters.jopa.moves).find(k=>characters.jopa.moves[k].damage>0)!],0,false,0,1,ally,c.fighter);
 assert.ok(c.fighter.health<GRAVE_HP);
 c.fighter.health=0;run(g,ZOMBIE_RISE_FRAMES+1);const z=c.fighter;
 z.x=ally.x-70;z.y=ally.y=0;z.facing=1;ally.invulnerableUntil=0;
 resolveHit(g.state,g.stage,()=>{},0,ZOMBIE_CLAW,0,false,1,1,z,ally);
 assert.equal(ally.poisonUntil-g.state.frame,120);assert.equal(ally.poisonDamage,8);
 const hp=ally.health;run(g,30);assert.ok(ally.health<=hp-8);
 const before=z.health;g.hit(1,ZOMBIE_CLAW,0,false,0,1,ally,z);assert.ok(z.health<before);
});
test('graves receive real player melee collisions without repeated contact damage',()=>{
 const g=game(),c=grave(g),f=g.state.fighters[1];f.x=c.fighter.x-80;f.y=c.fighter.y;f.facing=1;
 g.step([0,Button.Light,0,0]);run(g,16);assert.ok(c.fighter.health<GRAVE_HP);const hp=c.fighter.health;run(g,3);assert.equal(c.fighter.health,hp);
});
for(const stage of Object.values(stages))test(`${stage.name}: zombie follows fighters onto elevated platforms`,()=>{
 const g=game(undefined,stage),c=zombie(g),target=g.state.fighters[1];g.state.fighters[2].x=g.state.fighters[3].x=2350;
 const p=stage.platforms![0];target.x=p.x+p.width/2;target.y=p.y;target.vy=0;c.fighter.x=target.x;c.fighter.y=stage.floorHeight;c.undead!.target=1;
 let highest=0;
 for(let i=0;i<300;i++){g.step([0,0,0,0]);highest=Math.max(highest,c.fighter.y);if(c.fighter.undead==='dying')break;}
 assert.ok(highest>=p.y,`highest zombie position ${highest}, platform ${p.y}`);
});
test('snapshots and delayed rollback reproduce grave and zombie transitions',()=>{
 const a=game(),c=grave(a);c.fighter.health=0;const snapshot=a.snapshot();
 const b=game();b.restore(snapshot);const rb=new RollbackManager(b,1,0,8);rb.confirmed=b.state.frame-1;
 const delayed:{frame:number;mask:number}[]=[];
 for(let i=0;i<180;i++){
  const frame=a.state.frame,remote=i%30<15?Button.Left:Button.Right,inputs=[0,i%60<30?Button.Right:0,remote,0];
  a.step(inputs);rb.local.set(frame,inputs[1]);for(const seat of [0,3])rb.receive(frame,0,seat);assert.ok(rb.tick());
  delayed.push({frame,mask:remote});if(delayed.length>3){const next=delayed.shift()!;rb.receive(next.frame,next.mask,2);}
 }
 for(const next of delayed)rb.receive(next.frame,next.mask,2);
 assert.ok(rb.rollbackCount>0);
 assert.equal(hashState(a.state),hashState(b.state));
 const restored=game();restored.restore(snapshot);run(restored,180);assert.ok(restored.state.clones.some(c=>c.undead));
 clearCombatEntities(a.state);assert.equal(a.state.clones.length,0);a.resetPositions();assert.equal(a.state.finalDeaths,undefined);
});
test('DEAD voice waits for confirmation, fires once for simultaneous deaths, and resets',()=>{
 const g=game();kill(g,[0,1]);const spoken:string[]=[];
 const audio=new GameAudio({play(){},announce:(s:string)=>spoken.push(s),duck(){},syncAbilityLoops(){},setMusic(){},resetMatch(){}} as unknown as AudioManager);
 const consume=(confirmed:number)=>audio.consume(g.state,[],[],g.stage.id,g.stage.width,[2],true,'match',confirmed);
 consume(0);assert.deepEqual(spoken,[]);consume(g.state.frame);consume(g.state.frame);assert.deepEqual(spoken,['DEAD.']);audio.reset();consume(g.state.frame);assert.equal(spoken.length,2);
});
test('every roster move can resolve against a grave and zombie without corrupting health',()=>{
 for(const id of Object.keys(characters)){
  const g=game(['nikalz',id,'gut','drupa']),c=grave(g),source=g.state.fighters[1];
  for(const phase of ['grave','zombie'] as const)for(const move of Object.values(characters[id].moves)){
   if(!move.damage)continue;
   Object.assign(c.fighter,{undead:phase,health:5000,stun:0,state:'Idle',grappleUntil:0,trappedUntil:0,invulnerableUntil:0});
   source.stampAttempts=3;
   g.hit(1,move,0,false,0,1,source,c.fighter);
   assert.ok(Number.isFinite(c.fighter.health),`${id}.${move.id}`);
  }
 }
});

test('a real projectile damages a neutral grave and is consumed once',()=>{
 const g=game(['nikalz','tocha','gut','drupa']),c=grave(g);
 const move=Object.values(characters.tocha.moves).find(m=>m.projectile&&!m.returningProjectile)!;
 assert.ok(move);
 initializeProjectile(g.state.projectiles[0],{active:true,owner:1,x:c.fighter.x-70,y:c.fighter.y+65,vx:12,life:60,move:move.id,serial:9});
 run(g,4);assert.ok(c.fighter.health<GRAVE_HP);assert.equal(g.state.projectiles[0].active,false);
});
test('eight-fighter matches support six simultaneous independent zombies and clean reset',()=>{
 const g=game(['nikalz','jopa','gut','drupa','biel','caio','bozo','fausto']);kill(g,[0,1,2,3,4,5]);run(g,FINAL_DEATH_FRAMES);
 assert.equal(g.state.clones.length,6);for(const c of g.state.clones)c.fighter.health=0;run(g,ZOMBIE_RISE_FRAMES+1);
 assert.ok(g.state.clones.every(c=>c.fighter.undead==='zombie'));run(g,180);assert.ok(g.state.clones.every(c=>Number.isFinite(c.fighter.x)&&Number.isFinite(c.fighter.y)));
 g.resetPositions();assert.equal(g.state.clones.length,0);assert.equal(g.state.finalDeaths,undefined);
});

for(const stage of Object.values(stages))test(`${stage.name}: zombie can reach and land on the highest platform`,()=>{
 const g=game(undefined,stage),c=zombie(g),target=g.state.fighters[1];
 const p=stage.platforms!.reduce((a,b)=>a.y>b.y?a:b);target.x=p.x+p.width/2;target.y=p.y;target.vy=0;
 for(const f of g.state.fighters.slice(2)){f.x=2300;f.y=p.y;f.invulnerableUntil=100000;}
 target.invulnerableUntil=100000;c.fighter.x=target.x;c.fighter.y=stage.floorHeight;c.undead!.target=1;
 let landed=false;
 for(let i=0;i<1200;i++){for(const f of g.state.fighters.slice(2)){f.x=40;f.y=p.y;f.vy=0;}g.step([0,0,0,0]);if(c.fighter.y===p.y&&c.fighter.vy===0){landed=true;break;}}
 assert.ok(landed,`zombie at ${c.fighter.x},${c.fighter.y}; target at ${target.x},${target.y}`);
});

test('grave damage never causes fifth-hit escape displacement or combo scaling',()=>{
 const g=game(),c=grave(g),x=c.fighter.x;const move={...ZOMBIE_CLAW,damage:10,poisonFrames:undefined};
 for(let i=0;i<8;i++){g.hit(1,move,0,false,0,1,g.state.fighters[1],c.fighter);assert.equal(c.fighter.x,x);}
 assert.equal(c.fighter.health,GRAVE_HP-80);assert.equal(c.fighter.stun,0);
});
test('zombie clears walls and retargets when its living target is eliminated',()=>{
 const g=game(),c=zombie(g);c.fighter.x=300;g.state.fighters[1].x=1100;g.state.fighters[2].x=2200;g.state.fighters[3].x=2350;
 g.state.structures=[{id:0,owner:2,move:'test',kind:'wall',phase:'built',x:650,y:0,width:180,height:240,health:1000,maxHealth:1000,createdAt:g.state.frame,expiresAt:0,nextShot:0,shots:0,trapped:[],hits:{},facing:1}];
 run(g,1200);assert.ok(c.fighter.x>780,`blocked at ${c.fighter.x},${c.fighter.y}`);
 kill(g,[1]);run(g,1);assert.ok([2,3].includes(c.undead!.target));
});

test('zombie claw windup and contact freeze together during hitstop',()=>{
 const g=game(),c=zombie(g),target=g.state.fighters[1];c.fighter.x=target.x-75;c.fighter.y=target.y=0;c.undead!.nextAttack=0;
 run(g,1);assert.ok(c.undead!.attackAt>0);const hp=target.health;
 g.state.hitstop=10;run(g,10);assert.equal(c.undead!.attackFrame,0);assert.equal(target.health,hp);
 run(g,17);assert.equal(target.health,hp);run(g,1);assert.ok(target.health<hp);assert.equal(target.poisonUntil-g.state.frame,120);
});

test('a grave and rising zombie stay anchored even inside a constructed wall',()=>{
 const g=game(),c=grave(g),x=c.fighter.x,y=c.fighter.y;
 g.state.structures=[{id:0,owner:1,move:'test',kind:'wall',phase:'built',x,y,width:180,height:240,health:1000,maxHealth:1000,createdAt:g.state.frame,expiresAt:0,nextShot:0,shots:0,trapped:[],hits:{},facing:1}];
 run(g,10);assert.deepEqual([c.fighter.x,c.fighter.y],[x,y]);c.fighter.health=0;run(g,30);assert.equal(c.fighter.undead,'rising');assert.deepEqual([c.fighter.x,c.fighter.y],[x,y]);
});

 test('zombie pursuit is another 30 percent slower on the ground and in the air',()=>{
  for(const airborne of [false,true]){
   const g=game(),c=zombie(g),f=c.fighter;
   f.x=600;f.y=airborne?100:0;f.vy=0;f.stun=0;
   g.state.fighters.slice(1).forEach(t=>{t.x=1800;t.y=f.y;});
   c.undead!.target=1;c.undead!.attackAt=0;c.undead!.lastX=f.x;
   const shamble=.7+.6*(.5+.5*Math.sin((g.state.frame+c.id*17)*.12));
   const expected=Math.round((600+(airborne?3.8:2.2*shamble)*.49)*10)/10;
   advanceUndead(g.state,{...stages['the-foundry'],platforms:[]});
   assert.equal(f.x,expected);
  }
 });
