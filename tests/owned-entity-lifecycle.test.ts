import test from 'node:test';
import assert from 'node:assert/strict';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {Button} from '../packages/game-core/types.js';
import {resolveKnockouts,RESPAWN_FRAMES} from '../packages/game-core/simulation/LifeSystem.js';
import {activateStructure,damageStructure} from '../packages/game-core/simulation/StructureSystem.js';
import {activateFausto} from '../packages/game-core/simulation/FaustoSystem.js';
import {activateJopa,cleanupJopa,JOPA} from '../packages/game-core/simulation/JopaSystem.js';
import {activateNapa} from '../packages/game-core/simulation/NapaSystem.js';
import {summonClones} from '../packages/game-core/simulation/HairSystem.js';
import {activateNikalz} from '../packages/game-core/simulation/NikalzSystem.js';
import {FINAL_DEATH_FRAMES} from '../packages/game-core/simulation/UndeadSystem.js';
import {RollbackManager} from '../packages/networking/RollbackManager.js';
import {VerifiedMatch} from '../apps/server/src/verifiedMatch.js';
function game(ids=['nikalz','gut','bozo']){
 const g=new GameSimulation(ids);g.state.phase='fight';
 g.state.fighters.forEach((f,i)=>Object.assign(f,{state:'Idle',x:200+i*700,y:g.stage.floorHeight,meter:100}));return g;
}
function run(g:GameSimulation,n:number){for(let i=0;i<n;i++)g.step(g.state.fighters.map(()=>0));}
function owned(g:GameSimulation,owner=0){const s=g.state;return [
 ...s.clones.filter(c=>c.owner===owner&&!c.undead),...s.projectiles.filter(p=>p.owner===owner&&p.active),
 ...s.hazards.filter(h=>h.owner===owner),...(s.structures??[]).filter(b=>b.owner===owner),
 ...(s.bees??[]).filter(b=>b.owner===owner),...(s.foreheadWaves??[]).filter(w=>w.owner===owner)];}

for(const [id,c] of Object.entries(characters))for(const [index,move] of [...c.specialButtons,...c.superButtons].entries()){
 test(`${id}/${move}: losing a life preserves owned object identity/state; final elimination removes it`,()=>{
  const g=game([id,'gut','bozo']),f=g.state.fighters[0],button=[Button.Special,Button.Special2,Button.Super1,Button.Super2][index];
  g.step([button,0,0]);for(let i=0;i<c.moves[move].startupFrames+2;i++)g.step([button,0,0]);
  const lives=f.lives,existing=owned(g),before=structuredClone(existing);f.health=0;resolveKnockouts(g.state);
  assert.equal(f.lives,lives-1);assert.ok(f.respawnAt);assert.deepEqual(owned(g),before);
  existing.forEach((entity,i)=>assert.equal(owned(g)[i],entity));
  assert.equal(f.move,null);assert.equal(f.weaponUntil,0);assert.equal(f.armorUntil,0);assert.equal(f.onFireUntil,0);assert.equal(f.invulnerableUntil,0);
  // Final loss in a continuing FFA is not a match reset.
  f.respawnAt=0;f.lives=1;f.health=0;resolveKnockouts(g.state);
  assert.equal(g.state.phase,'fight');assert.equal(owned(g).length,0);
  run(g,FINAL_DEATH_FRAMES+1);assert.ok(g.state.clones.some(c=>c.owner===0&&c.undead));
 });
}

test('independent clone AI attacks during respawn and the same companions survive respawn',()=>{
 const g=game(['bozo','gut','nikalz']),[f,d]=g.state.fighters;d.x=f.x+140;
 summonClones(g.state,0,g.stage);const clones=[...g.state.clones];clones.forEach(c=>c.fighter.health-=11);
 f.health=0;g.step([0,0,0]);const hp=d.health;
 run(g,90);assert.ok(f.respawnAt>g.state.frame);assert.ok(d.health<hp);
 assert.deepEqual(g.state.clones.map(c=>c.id),clones.map(c=>c.id));
 run(g,RESPAWN_FRAMES);assert.equal(f.respawnAt,0);assert.equal(g.state.clones.length,3);
 clones.forEach(c=>assert.ok(g.state.clones.includes(c)));assert.equal(f.weaponUntil,0);
});

test('turret operates, structures take damage and traps expire naturally during respawn',()=>{
 const g=game(['luizinho','gut','fausto']),[f]=g.state.fighters;
 activateStructure(g.state,g.stage,f,0,characters.luizinho.moves.turret);
 const turret=g.state.structures![0];turret.nextShot=g.state.frame+2;turret.health-=50;
 f.health=0;g.step([0,0,0]);const hp=turret.health;
 damageStructure(g.state,turret,10,'enemy',0,g.stage);assert.equal(turret.health,hp-10);
 run(g,60);assert.ok(turret.shots>0);assert.ok(g.state.structures!.includes(turret));
 const caster=g.state.fighters[2];activateFausto(g.state,g.stage,caster,2,characters.fausto.moves.cloud);
 const cloud=g.state.hazards.find(h=>h.kind==='white-cloud')??g.state.hazards.at(-1)!;cloud.expiresAt=g.state.frame+5;
 caster.health=0;g.step([0,0,0]);assert.ok(g.state.hazards.includes(cloud));run(g,6);
 assert.ok(!g.state.hazards.includes(cloud));assert.ok(caster.respawnAt>g.state.frame);
});

test('bee boxes keep their counters and emit while their owner is respawning',()=>{
 const g=game(),f=g.state.fighters[0];activateStructure(g.state,g.stage,f,0,characters.nikalz.moves.placeBox);
 const box=g.state.structures![0];box.nextShot=g.state.frame+3;box.shots=2;box.health-=80;
 f.health=0;g.step([0,0,0]);assert.equal(box.shots,2);run(g,4);
 assert.equal(box.shots,3);assert.ok(g.state.bees?.some(b=>b.owner===0));assert.ok(g.state.structures!.includes(box));
});

test('dead riders dismount without deleting knights or moving the respawning fighter',()=>{
 const g=game(['jopa','gut','nikalz']),f=g.state.fighters[0];activateJopa(g.state,g.stage,f,0,characters.jopa.moves.knight);
 const knight=g.state.clones[0];f.health=0;g.step([0,0,0]);const position=[f.x,f.y];run(g,10);
 assert.equal(knight.rider,undefined);assert.equal(f.jopaRide,undefined);assert.deepEqual([f.x,f.y],position);assert.ok(g.state.clones.includes(knight));
});

test('detached tree expiry still spawns tentacles without canceling a respawned owners new action',()=>{
 const g=game(['jopa','gut','nikalz']),f=g.state.fighters[0];activateJopa(g.state,g.stage,f,0,characters.jopa.moves.tree);
 const tree=g.state.clones[0];f.health=0;resolveKnockouts(g.state);run(g,RESPAWN_FRAMES);
 Object.assign(f,{move:'chess',state:'SpecialMove',moveFrame:0});tree.bornAt=g.state.frame-JOPA.treeLifetime;
 cleanupJopa(g.state,g.stage);assert.equal(f.move,'chess');assert.equal(g.state.clones.filter(c=>c.kind==='tentacle').length,5);
 assert.equal(g.state.treeDeaths?.length,1);
});

test('summon natural destruction during owner respawn keeps its existing drop behavior',()=>{
 const g=game(['napa','gut','nikalz']),f=g.state.fighters[0];activateNapa(g.state,g.stage,f,0,characters.napa.moves.cookieMonster);
 f.health=0;resolveKnockouts(g.state);g.state.clones[0].fighter.health=0;g.step([0,0,0]);
 assert.equal(g.state.clones.length,0);assert.equal(g.state.hazards.filter(h=>h.kind==='cookie-drop').length,5);
 run(g,3);assert.equal(g.state.hazards.filter(h=>h.kind==='cookie-drop').length,5);
 f.respawnAt=0;f.lives=1;f.health=0;resolveKnockouts(g.state);assert.equal(owned(g).length,0);
});

test('simultaneous losses keep independent objects; final cleanup preserves unrelated owners and undead',()=>{
 const g=game(['nikalz','nikalz','gut','bozo']);
 for(let i=0;i<2;i++)activateNikalz(g.state,g.stage,g.state.fighters[i],i,characters.nikalz.moves.bees);
 g.state.fighters[0].health=g.state.fighters[1].health=0;resolveKnockouts(g.state);assert.equal(g.state.bees?.length,2);
 const f=g.state.fighters[0];f.respawnAt=0;f.health=0;f.lives=1;resolveKnockouts(g.state);
 assert.deepEqual(g.state.bees?.map(b=>b.owner),[1]);
});

test('owned DOT continues across one life but stops at final elimination',()=>{
 const g=game(),[f,d]=g.state.fighters;Object.assign(d,{burnOwner:0,burnUntil:1000,burnNextTick:5,burnDamage:10,poisonOwner:0,poisonUntil:1000,poisonNextTick:5,poisonDamage:10});
 f.health=0;resolveKnockouts(g.state);const hp=d.health;run(g,8);assert.ok(d.health<hp);
 f.respawnAt=0;f.health=0;f.lives=1;resolveKnockouts(g.state);assert.equal(d.burnUntil,0);assert.equal(d.poisonUntil,0);
});

test('server and rollback peers preserve the same summon state across death and respawn',()=>{
 const make=()=>{const g=game(['bozo','gut','nikalz']);summonClones(g.state,0,g.stage);g.state.fighters[0].health=1;g.state.fighters[1].x=280;g.state.clones.forEach(c=>c.fighter.x=1800);return g;};
 const server=new VerifiedMatch(make(),()=>{}),local=make(),predicted=make();local.restore(server.simulation.snapshot());predicted.restore(local.snapshot());
 const peer=new RollbackManager(predicted,0,0,8);peer.confirmed=local.state.frame-1;let lost=false;
 for(let n=0;n<220;n++){
  const frame=local.state.frame,masks=[0,n===0?Button.Left|Button.Light:0,0];local.step(masks);
  masks.forEach((mask,seat)=>server.receive(seat,frame,mask));peer.local.set(frame,0);peer.receive(frame,0,2);assert.ok(peer.tick());peer.receive(frame,masks[1],1);
  if(local.state.fighters[0].respawnAt){lost=true;assert.equal(local.state.clones.length,3);}
 }
 assert.ok(lost);assert.equal(local.state.fighters[0].lives,2);assert.equal(local.state.fighters[0].respawnAt,0);
 assert.equal(hashState(local.state),hashState(server.simulation.state));assert.equal(hashState(local.state),hashState(predicted.state));
});

for(const mode of ['ffa','teams','round-tournament','elimination','elimination-party'] as const)test(`${mode}: life loss retains companions, departure and reset remove them`,()=>{
 const ids=Array(6).fill('bozo');
 const competition=mode==='round-tournament'?true:mode==='elimination'||mode==='elimination-party'?mode:false;
 const g=new GameSimulation(ids,false,undefined,mode==='teams'?[0,0,0,1,1,1]:undefined,undefined,competition);
 g.state.phase='fight';g.state.fighters.forEach((f,i)=>Object.assign(f,{state:'Idle',x:200+i*400,health:50000}));
 summonClones(g.state,0,g.stage);const existing=[...g.state.clones];
 g.state.fighters[0].health=0;g.step(ids.map(()=>0));assert.equal(g.state.clones.length,3);
 run(g,RESPAWN_FRAMES+2);assert.equal(g.state.fighters[0].respawnAt,0);assert.ok(existing.every(c=>g.state.clones.includes(c)));
 g.step(ids.map(()=>0),[0]);assert.equal(owned(g).length,0);
 g.resetPositions();assert.equal(g.state.clones.length,0);assert.equal(g.state.hazards.length,0);
});
