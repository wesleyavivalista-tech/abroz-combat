import test from 'node:test';
import assert from 'node:assert/strict';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {RollbackManager} from '../packages/networking/RollbackManager.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {FINAL_DEATH_FRAMES,GRAVE_HP} from '../packages/game-core/simulation/UndeadSystem.js';
import {RESPAWN_FRAMES} from '../packages/game-core/simulation/LifeSystem.js';
import {createFighter} from '../packages/game-core/simulation/Fighter.js';
import {activateJopa,advanceJopa} from '../packages/game-core/simulation/JopaSystem.js';
import {startJomp} from '../packages/game-core/simulation/JompSystem.js';
import {advanceStatuses} from '../packages/game-core/simulation/StatusSystem.js';
import {activateBlood,advanceBlood,movementSlow} from '../packages/game-core/simulation/BloodSystem.js';
import {activateNapa,advanceNapa} from '../packages/game-core/simulation/NapaSystem.js';
import {activateFausto,advanceFausto} from '../packages/game-core/simulation/FaustoSystem.js';
import {activateAstolfo,advanceAstolfo} from '../packages/game-core/simulation/AstolfoSystem.js';
import {activateStructure} from '../packages/game-core/simulation/StructureSystem.js';
import {Button,type MoveDefinition} from '../packages/game-core/types.js';

function fixture(id:string){
 const g=new GameSimulation([id,id,'gut','tocha']);g.state.phase='fight';
 g.state.fighters.forEach((f,i)=>Object.assign(f,{state:'Idle',x:300+i*600,y:g.stage.floorHeight,meter:100}));
 return g;
}
const firstActivation=(m:MoveDefinition)=>Math.min(m.startupFrames,m.hazard?.startFrame??m.startupFrames);
function hold(m:MoveDefinition){return m.channelHeal?.button??m.holdInvisible??m.beam?.holdButton??(m.talking?Button.Special:m.chargeFrames?Button.Heavy:0);}
/** Prime an authored activation boundary, retaining the normal simulation pipeline.
 * Prerequisites and companion-only actions are represented explicitly. Input cost,
 * startup routing and animations are covered separately by the fighter suites. */
function prime(g:GameSimulation,owner:number,m:MoveDefinition){
 let f=g.state.fighters[owner];
 if(m.id.startsWith('boss')&&f.characterId==='napa'||['pkJab','pkCross','pkFinish','ball'].includes(m.id)&&f.characterId==='dodo'){
  f=createFighter(f.characterId,f.x+90,f.facing);f.state='Idle';f.y=g.stage.floorHeight;f.lives=1;
  if(f.characterId==='napa')f.cookieBoss=true;else f.companionVariant=0;
  g.state.clones.push({id:g.state.nextCloneId++,owner,fighter:f,kind:f.cookieBoss?'cookie-monster':'basketball',maxHealth:f.health,nextAction:g.state.frame+9999});
 }
 const c=characters[f.characterId];
 if(c.weaponAttacks&&Object.values(c.weaponAttacks).flat().includes(m.id))f.weaponUntil=g.state.frame+5000;
 if(m.loanStamp)f.stampAttempts=5;
 if(m.financeAbility==='feathers'||m.financeAbility==='dive'||m.beam?.holdButton&&c.financeMoves)f.angelUntil=g.state.frame+5000;
 if(m.nikalzAbility==='place')f.beeBoxes=5;
 if(m.buildMarkedStructure)activateStructure(g.state,g.stage,f,owner,c.moves.home);
 Object.assign(f,{move:m.id,moveFrame:firstActivation(m)-1,state:m.state,attackSerial:1,connected:false,hitTargets:[],projectileSpawned:false});
 if(m.state==='AirAttack'){f.y+=200;f.vy=-1;}
 if(m.chargeFrames){f.chargeButton=Button.Heavy;f.chargeStartedAt=g.state.frame-m.startupFrames;}
 if(m.invisibilityFrames)f.invisibleUntil=g.state.frame+m.invisibilityFrames;
 startJomp(g.state,f);
 return f;
}
function ownedCleared(g:GameSimulation,owner:number){
 const s=g.state;
 assert.ok(!s.projectiles.some(p=>p.active&&p.owner===owner));
 assert.ok(!s.clones.some(c=>c.owner===owner));
 assert.ok(!s.hazards.some(h=>h.owner===owner&&h.kind!=='cookie-drop'));
 assert.ok(!s.structures?.some(b=>b.owner===owner));
 assert.ok(!s.bees?.some(b=>b.owner===owner));assert.ok(!s.foreheadWaves?.some(w=>w.owner===owner));
 const f=s.fighters[owner];assert.equal(f.move,null);assert.equal(f.weaponUntil,0);assert.equal(f.grappleUntil,0);
 assert.equal(f.jopaRide,undefined);assert.equal(f.jopaTree,undefined);
}

for(const [id,c] of Object.entries(characters)){
 test(`${id}: delayed disconnect rolls back every active ability without stale effects`,()=>{
  for(const m of Object.values(c.moves)){
   const live=fixture(id);prime(live,1,m);
   const baseline=fixture(id);baseline.restore(live.snapshot());
   const peer=new RollbackManager(live,0,0);
   for(let frame=0;frame<12;frame++){
    peer.schedule(0,()=>{});
    for(let seat=1;seat<4;seat++)peer.receive(frame,seat===1?hold(m):0,seat);
    assert.equal(peer.tick(),true,`${id}/${m.id}: tick ${frame}`);
    baseline.step([0,frame<4?hold(m):0,0,0],frame===4?[1]:[]);
    if(frame===9)peer.disconnect(1,4);
   }
   assert.equal(peer.desync,'OK');assert.equal(peer.rollbackCount,1);
   assert.equal(hashState(live.state),hashState(baseline.state),`${id}/${m.id}`);
   ownedCleared(live,1);
   // A stale input packet after the departure cannot revive or mutate its owner.
   const hash=hashState(live.state);peer.receive(5,Button.Super1,1);
   assert.equal(hashState(live.state),hash);
  }
 });
 test(`${id}: all move contacts respect every roster target's team, death and invulnerability`,()=>{
  for(const m of Object.values(c.moves))for(const target of Object.keys(characters))for(const protection of ['ally','dead','invulnerable'] as const){
   const g=new GameSimulation([id,target]);g.state.phase='fight';g.state.fighters.forEach(f=>f.state='Idle');
   const [a,d]=g.state.fighters;if(m.loanStamp)a.stampAttempts=5;
   if(protection==='ally')g.state.teams[1]=g.state.teams[0];
   if(protection==='dead'){d.health=0;d.lives=0;d.state='KO';}
   if(protection==='invulnerable')d.invulnerableUntil=1000;
   const before=JSON.stringify(d);g.hit(0,m,0,false,1);
   assert.equal(JSON.stringify(d),before,`${id}/${m.id}/${target}/${protection}`);
  }
 });
 test(`${id}: every ability supports simultaneous owners, forfeit cleanup and deterministic replay`,()=>{
  for(const m of Object.values(c.moves)){
   const g=fixture(id);prime(g,0,m);prime(g,1,m);
   for(let i=0;i<m.startupFrames-firstActivation(m)+4;i++)g.step([hold(m),hold(m),0,0]);
   const snapshot=g.snapshot();
   g.step([0,hold(m),0,0],[0]);ownedCleared(g,0);
   const hash=hashState(g.state);g.restore(snapshot);g.step([0,hold(m),0,0],[0]);assert.equal(hashState(g.state),hash,`${id}/${m.id}`);
   // Replay the opposite departure with the original caster still present.
   g.restore(snapshot);g.step([0,0,0,0],[1]);ownedCleared(g,1);
   for(let i=0;i<60;i++)g.step([0,0,0,0]);
   assert.ok(g.state.fighters.every(f=>[f.x,f.y,f.health,f.vx,f.vy].every(Number.isFinite)),`${id}/${m.id}`);
   assert.equal(new Set(g.state.clones.map(c=>c.id)).size,g.state.clones.length);
   assert.equal(g.state.fighters[0].grappleUntil,0);
   // Ordinary death uses a respawn, whereas a disconnect forfeits the seat.
   g.restore(snapshot);g.state.fighters[0].health=0;g.step([0,0,0,0]);assert.equal(g.state.fighters[0].move,null);assert.equal(g.state.fighters[0].weaponUntil,0);assert.ok(g.state.fighters[0].respawnAt);
   g.restore(snapshot);g.step([0,0,0,0],[1,2,3]);assert.equal(g.state.phase,'result');
   for(let owner=0;owner<4;owner++)ownedCleared(g,owner);
   g.resetPositions();for(let owner=0;owner<4;owner++)ownedCleared(g,owner);
  }
 });
 test(`${id}: all activated abilities leave allies and invulnerable enemies unharmed`,()=>{
  for(const m of Object.values(c.moves)){
   const g=fixture(id);g.state.teams=[0,0,1,1];
   const [a,ally,protectedTarget]=g.state.fighters;ally.x=a.x+90;protectedTarget.x=a.x+170;protectedTarget.invulnerableUntil=10000;
   const hp=[ally.health,protectedTarget.health];prime(g,0,m);
   for(let i=0;i<100;i++)g.step([hold(m),0,0,0]);
   assert.deepEqual([ally.health,protectedTarget.health],hp,`${id}/${m.id}`);
   for(const f of [ally,protectedTarget]){
    assert.equal(f.stun,0);assert.equal(f.grappleUntil,0);assert.equal(f.trappedUntil,0);
    assert.equal(f.burnUntil,0);assert.equal(f.poisonUntil,0);assert.equal(f.areaSlow,1);
    assert.ok(!f.loanUntil&&!f.beeSlowUntil&&!f.movementSlowUntil&&!f.sadnessUntil);
   }
  }
 });
}

for(const kind of ['football','chess'] as const)test(`Jopa ${kind} credits the owner once per confirmed hit`,()=>{
 const g=fixture('jopa'),[caster,target]=g.state.fighters;caster.meter=0;target.x=caster.x+(kind==='football'?85:115);
 activateJopa(g.state,g.stage,caster,0,characters.jopa.moves[kind]);
 const before=target.health;g.state.frame++;advanceJopa(g.state,g.stage);
 assert.ok(target.health<before);assert.equal(caster.meter,3);
 const after=target.health;g.state.frame++;advanceJopa(g.state,g.stage);assert.equal(target.health,after);assert.equal(caster.meter,3);
});

test('Jopa tentacle credits its distinct owner once while preserving companion energy',()=>{
 const g=fixture('jopa'),[caster,target]=g.state.fighters;caster.meter=0;
 activateJopa(g.state,g.stage,caster,0,characters.jopa.moves.tree);
 const tree=g.state.clones[0];tree.nextAction=g.state.frame;
 advanceJopa(g.state,g.stage);const tentacle=g.state.clones.find(c=>c.kind==='tentacle')!;
 target.x=tentacle.fighter.x+80;target.y=tentacle.fighter.y;tentacle.nextAction=g.state.frame+1;
 g.state.frame++;advanceJopa(g.state,g.stage);
 assert.ok(target.health<characters[target.characterId].stats.maxHealth);
 assert.equal(caster.meter,3);assert.equal(tentacle.fighter.meter,3);
});

test('requested Nikalz health is 1400 at spawn and respawn, while bee boxes remain 550 HP',()=>{
 const g=fixture('nikalz'),f=g.state.fighters[0];assert.equal(f.health,1400);
 activateStructure(g.state,g.stage,f,0,characters.nikalz.moves.placeBox);
 assert.equal(g.state.structures![0].health,550);
 f.health=0;g.step([0,0,0,0]);for(let i=0;i<RESPAWN_FRAMES;i++)g.step([0,0,0,0]);
 assert.equal(f.health,1400);
});

test('requested doubled tomb health is 1000 and resurrection still requires its destruction',()=>{
 const g=fixture('nikalz'),f=g.state.fighters[0];f.lives=1;f.health=0;g.step([0,0,0,0]);
 for(let i=0;i<FINAL_DEATH_FRAMES;i++)g.step([0,0,0,0]);
 const tomb=g.state.clones.find(c=>c.fighter.undead==='grave')!;assert.ok(tomb);assert.equal(GRAVE_HP,1000);assert.equal(tomb.fighter.health,1000);
 tomb.fighter.health-=500;g.step([0,0,0,0]);assert.equal(tomb.fighter.undead,'grave');assert.equal(tomb.fighter.health,500);
 tomb.fighter.health=0;g.step([0,0,0,0]);assert.equal(tomb.fighter.undead,'rising');assert.equal(tomb.fighter.health,1400);
});

test('two Tocha pentagrams keep independent hit clocks without duplicate same-tick damage',()=>{
 const g=fixture('tocha'),target=g.state.fighters[2];
 prime(g,0,characters.tocha.moves.pentagram);prime(g,1,characters.tocha.moves.pentagram);g.step([0,0,0,0]);
 const hazards=g.state.hazards.filter(h=>!h.kind);assert.equal(hazards.length,2);
 for(const h of hazards){h.x=target.x;h.y=target.y;}
 const hp=target.health;g.state.frame++;advanceStatuses(g.state,g.stage.width,g.stage.floorHeight);
 assert.equal(target.health,hp-36);advanceStatuses(g.state,g.stage.width,g.stage.floorHeight);assert.equal(target.health,hp-36);
 g.state.frame+=30;advanceStatuses(g.state,g.stage.width,g.stage.floorHeight);assert.equal(target.health,hp-72);
});

test('Caio, Napa, Fausto and Astolfo slows overlap without multiplying and clear on leaving',()=>{
 const g=new GameSimulation(['caio','napa','fausto','astolfo','gut']);g.state.phase='fight';
 g.state.fighters.forEach(f=>Object.assign(f,{state:'Idle',x:800,y:g.stage.floorHeight}));
 activateBlood(g.state,g.stage,g.state.fighters[0],0,characters.caio.moves.flood);
 activateNapa(g.state,g.stage,g.state.fighters[1],1,characters.napa.moves.sneeze);
 activateFausto(g.state,g.stage,g.state.fighters[2],2,characters.fausto.moves.cloud);
 activateAstolfo(g.state,g.stage,g.state.fighters[3],3,characters.astolfo.moves.idea);
 const f=g.state.fighters[4];g.state.frame=90;
 const update=()=>{advanceBlood(g.state,g.stage);advanceNapa(g.state,g.stage);advanceFausto(g.state);advanceAstolfo(g.state,g.stage);};
 update();assert.equal(movementSlow(f,g.state.frame),.2);
 g.state.hazards.find(h=>h.kind==='blood-flood')!.expiresAt=g.state.frame+1;g.state.frame++;update();assert.equal(movementSlow(f,g.state.frame),.3);
 f.x=g.stage.width-40;g.state.frame++;update();assert.equal(movementSlow(f,g.state.frame),1);
});

test('an allied knight rider is released when Jopa forfeits without removing the ally',()=>{
 const g=new GameSimulation(['jopa','gut','tocha','bozo'],false,undefined,[0,0,1,1]);g.state.phase='fight';
 g.state.fighters.forEach((f,i)=>Object.assign(f,{state:'Idle',x:300+i*500,y:g.stage.floorHeight}));
 activateJopa(g.state,g.stage,g.state.fighters[0],0,characters.jopa.moves.knight);
 g.step([Button.Medium,0,0,0]);const knight=g.state.clones[0],ally=g.state.fighters[1];
 knight.fighter.x=600;knight.fighter.y=g.stage.floorHeight;knight.fighter.vy=0;knight.nextAction=10000;
 ally.x=700;g.state.fighters[0].x=200;
 g.step([0,Button.Medium,0,0]);assert.equal(ally.jopaRide,knight.id);
 g.step([0,0,0,0],[0]);assert.equal(ally.jopaRide,undefined);assert.ok(ally.lives>0);assert.ok(!g.state.clones.includes(knight));
 for(let i=0;i<90;i++)g.step([0,0,0,0]);const x=ally.x;g.step([0,Button.Right,0,0]);assert.ok(ally.x>x);
});
