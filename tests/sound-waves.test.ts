import test from 'node:test';
import assert from 'node:assert/strict';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {spawnSoundWave,advanceSoundWaves,SOUND_WAVE} from '../packages/game-core/simulation/SoundWaveSystem.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {resolveHit} from '../packages/game-core/combat/CombatSystem.js';
import {DodoEffects} from '../apps/client/src/rendering/DodoEffects.js';
import {encodeSnapshot,decodeSnapshot} from '../packages/shared/recovery.js';
import {RollbackManager} from '../packages/networking/RollbackManager.js';
import {VerifiedMatch} from '../apps/server/src/verifiedMatch.js';
import {Button} from '../packages/game-core/types.js';
function game(){const g=new GameSimulation(['dodo','gut','gut','gut']);g.state.phase='fight';g.state.fighters.forEach(f=>{f.state='Idle';f.health=10000;f.y=0;});return g;}
function advance(g:GameSimulation){g.state.frame++;advanceSoundWaves(g.state,g.stage,(p,d,seat,dir)=>resolveHit(g.state,g.stage,()=>{},p.owner,characters.dodo.moves[p.move],d.previousInput,false,seat,dir,g.state.fighters[p.owner],d));}
for(const continuous of [false,true])test(`${continuous?'Guitar Star':'regular'} chain obeys generation limit through a line of opponents`,()=>{
 const g=game(),s=g.state;s.fighters.forEach((f,i)=>f.x=[100,200,380,560][i]);
 const f=s.fighters[0];if(continuous)f.weaponUntil=1000;
 spawnSoundWave(s,g.stage,f,0,continuous?characters.dodo.moves.starWave:characters.dodo.moves.chord);
 for(const root of s.projectiles.filter(p=>p.active)){root.soundWave!.range=200;root.life=16;}
 for(let i=0;i<90;i++)advance(g);
 assert.deepEqual(s.fighters.map(f=>10000-f.health),[0,continuous?338:90,continuous?338:90,continuous?180:0]);
 assert.ok(!s.projectiles.some(p=>p.active));
});
test('wave collisions cover the four cardinal directions with existing charged damage',()=>{
 for(const [dx,dy] of [[200,0],[-200,0],[0,200],[0,-200]]){
  const g=game(),s=g.state,[f,d]=s.fighters;f.x=1000;f.y=400;f.weaponUntil=1000;
  d.x=f.x+dx;d.y=f.y+dy;s.fighters.slice(2).forEach(f=>f.x=2300);
  spawnSoundWave(s,g.stage,f,0,characters.dodo.moves.starWave);
  for(let i=0;i<15;i++)advance(g);
  assert.equal(d.health,9820,`${dx},${dy}`);
  assert.ok(s.projectiles.some(p=>p.active&&p.soundWave?.generation===1&&p.soundWave.visited.includes('seat:1')));
 }
});
test('waves respect allies, recovery protection, blocking, solid walls and pass one-way platforms',()=>{
 for(const mode of ['ally','immune','block','wall','platform']){
  const g=game(),s=g.state,[f,d]=s.fighters;f.x=100;d.x=300;s.fighters.slice(2).forEach(f=>f.x=2300);
  if(mode==='ally')s.teams[1]=s.teams[0];if(mode==='immune')d.invulnerableUntil=1000;
  if(mode==='block')d.previousInput=Button.Right;
  if(mode==='wall')s.structures=[{id:0,owner:1,kind:'wall',move:'wall',phase:'built',x:200,y:0,width:40,height:300,health:300,maxHealth:300,createdAt:0,expiresAt:1000,hits:{},trapped:[],nextShot:0,shots:0,facing:1}];
  if(mode==='platform')g.stage={...g.stage,platforms:[{x:180,y:100,width:40}]} as typeof g.stage;
  spawnSoundWave(s,g.stage,f,0,characters.dodo.moves.chord);for(let i=0;i<20;i++)advance(g);
  assert.equal(d.health,mode==='block'?9964:mode==='platform'?9910:10000,mode);
 }
});
test('overlapping explosions remain finite; independent chains can hit again; pool remains bounded',()=>{
 const g=game(),s=g.state;s.fighters.forEach((f,i)=>f.x=500+i*40);s.fighters[0].weaponUntil=1000;
 spawnSoundWave(s,g.stage,s.fighters[0],0,characters.dodo.moves.chord);
 for(let i=0;i<50;i++)advance(g);
 assert.ok(s.fighters.slice(1).every(f=>f.health>=9730&&f.health<=9910));
 const healthBefore=s.fighters.slice(1).map(f=>f.health);
 s.fighters.forEach(f=>{f.combo=0;f.stun=0;f.state='Idle';});
 spawnSoundWave(s,g.stage,s.fighters[0],0,characters.dodo.moves.chord);for(let i=0;i<50;i++)advance(g);
 assert.ok(s.fighters.slice(1).every((f,i)=>f.health<healthBefore[i]));
 for(let i=0;i<100;i++){s.frame++;spawnSoundWave(s,g.stage,s.fighters[0],0,characters.dodo.moves.chord);}
 assert.ok(s.projectiles.filter(p=>p.active&&p.soundWave).length<=SOUND_WAVE.maxActive);
 g.resetPositions();assert.ok(!s.projectiles.some(p=>p.active));
});
test('secondary waves use the original directional arcs in four directions',()=>{
 const g=game(),s=g.state;s.fighters.forEach((f,i)=>f.x=100+i*150);
 spawnSoundWave(s,g.stage,s.fighters[0],0,characters.dodo.moves.chord);for(let i=0;i<12;i++)advance(g);
 const child=s.projectiles.find(p=>p.active&&p.soundWave?.generation===1)!;assert.ok(child);assert.ok(child.soundWave!.visited.includes('seat:1'));assert.ok(s.projectiles.some(p=>p.active&&p.soundWave?.generation===1&&p.vy!==0));
 const renderer=new DodoEffects();renderer.update(s,false);
 const rings=renderer.root.children.filter(c=>c.visible);assert.ok(rings.length>3);assert.ok(rings.every(c=>c.userData.front===1));
});
for(const star of [false,true])test(`server, late-input rollback and encoded recovery agree through ${star?'charged':'regular'} propagation`,()=>{
 const a=game();a.state.fighters[0].meter=100;if(star)a.state.fighters[0].weaponUntil=1000;a.state.fighters.forEach((f,i)=>f.x=500+i*180);
 const b=game();b.restore(a.snapshot());const server=new VerifiedMatch(game(),()=>{});server.simulation.restore(a.snapshot());
 const rb=new RollbackManager(b,0,0,8);rb.confirmed=b.state.frame-1;
 for(let n=0;n<140;n++){
  const frame=a.state.frame,local=star?(n<65?Button.Light:0):(n===0?Button.Special:0),remote=n%20<10?Button.Right:0;
  a.step([local,remote,0,0]);for(let seat=0;seat<4;seat++)server.receive(seat,frame,[local,remote,0,0][seat]);
  rb.local.set(frame,local);rb.receive(frame,0,2);rb.receive(frame,0,3);assert.ok(rb.tick());rb.receive(frame,remote,1);
 }
 assert.ok(rb.rollbackCount>0);assert.equal(hashState(a.state),hashState(b.state));assert.equal(hashState(a.state),hashState(server.simulation.state));
 const c=game();c.restore(decodeSnapshot(encodeSnapshot(a.snapshot())));for(let i=0;i<100;i++){a.step([0,0,0,0]);c.step([0,0,0,0]);}assert.equal(hashState(a.state),hashState(c.state));
});

test('directional sound waves leave diagonal gaps rather than expanding as a circle',()=>{
 const g=game(),s=g.state,[f,d]=s.fighters;f.x=700;f.y=400;d.x=1000;d.y=700;s.fighters.slice(2).forEach(f=>f.x=2300);
 spawnSoundWave(s,g.stage,f,0,characters.dodo.moves.chord);
 for(let i=0;i<40;i++)advance(g);
 assert.equal(d.health,10000);
 const primary=s.projectiles.filter(p=>p.active&&p.soundWave?.generation===0);
 assert.equal(primary.length,4);assert.ok(primary.every(p=>(p.vx===0)!==(p.vy===0)));
});

for(const move of ['chord','starWave'])test(`${move} secondary waves retain full original range, speed, damage and appearance`,()=>{
 const g=game(),s=g.state,[f]=s.fighters;s.fighters.forEach((f,i)=>f.x=[100,300,1100,1900][i]);
 if(move==='starWave')f.weaponUntil=10000;
 const definition=characters.dodo.moves[move],spec=definition.projectile!;
 spawnSoundWave(s,g.stage,f,0,definition);
 const originalRange=s.projectiles.find(p=>p.active)!.soundWave!.range;
 let children:typeof s.projectiles=[];
 for(let i=0;i<30&&!children.length;i++){
  advance(g);children=s.projectiles.filter(p=>p.active&&p.soundWave?.generation===1);
 }
 assert.equal(children.length,4);
 for(const child of children){
  assert.equal(child.move,move);assert.equal(child.soundWave!.range,originalRange);
  assert.equal(child.life,Math.ceil(originalRange/spec.speed));
  assert.equal(Math.abs(child.vx)+Math.abs(child.vy??0),spec.speed);
  assert.equal(characters.dodo.moves[child.move].projectile!.visual,spec.visual);
  assert.equal(child.x,300);assert.equal(child.y,100);
 }
 for(let i=0;i<160;i++)advance(g);
 assert.ok(s.fighters[1].health<=10000-definition.damage);
 assert.ok(s.fighters[2].health<=10000-definition.damage,'secondary reaches a target 800 units away');
 assert.equal(s.fighters[3].health,move==='starWave'?10000-definition.damage:10000);
});

test('regular secondary explosion damages an already-hit opponent without propagating again',()=>{
 const g=game(),s=g.state,[f,a,b]=s.fighters;f.x=500;a.x=250;b.x=750;s.fighters[3].x=2300;
 spawnSoundWave(s,g.stage,f,0,characters.dodo.moves.chord);
 const contacts:{seat:number;generation:number;burst:string}[]=[];
 for(let i=0;i<100;i++){
  s.frame++;
  advanceSoundWaves(s,g.stage,(p,d,seat)=>{contacts.push({seat,generation:p.soundWave!.generation,burst:p.soundWave!.burst});d.health-=90;});
 }
 for(const seat of [1,2]){
  assert.equal(contacts.filter(c=>c.seat===seat&&c.generation===0).length,1);
  assert.equal(contacts.filter(c=>c.seat===seat&&c.generation===1).length,1);
 }
 assert.ok(s.projectiles.every(p=>!p.soundWave||p.soundWave.generation<=1));
 assert.equal(new Set(contacts.map(c=>`${c.seat}:${c.burst}`)).size,contacts.length);
});

test('Guitar Star secondary waves re-damage prior targets but never restart their explosions',()=>{
 const g=game(),s=g.state,[f]=s.fighters;f.weaponUntil=10000;s.fighters.forEach((f,i)=>f.x=[100,300,550,800][i]);
 spawnSoundWave(s,g.stage,f,0,characters.dodo.moves.starWave);
 const contacts:{seat:number;burst:string}[]=[],origins=new Set<string>();
 for(let i=0;i<250;i++){
  s.frame++;
  advanceSoundWaves(s,g.stage,(p,d,seat)=>{contacts.push({seat,burst:p.soundWave!.burst});d.health-=180;});
  for(const p of s.projectiles)if(p.active&&p.soundWave!.generation>0)origins.add(p.soundWave!.burst);
 }
 assert.deepEqual([...origins].sort(),['seat:1','seat:2','seat:3']);
 assert.ok(contacts.some(c=>c.seat===1&&c.burst==='seat:2'),'returning secondary wave damages the first opponent again');
 assert.ok(contacts.some(c=>c.seat===2&&c.burst==='seat:3'),'later generations still damage previously hit opponents');
 assert.equal(new Set(contacts.map(c=>`${c.seat}:${c.burst}`)).size,contacts.length);
 assert.ok(s.projectiles.every(p=>!p.active),'finite chain fully expires');
});
