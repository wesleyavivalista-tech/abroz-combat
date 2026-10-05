import {test} from 'node:test';
import assert from 'node:assert/strict';
import {characters,registerCharacter,validateCharacter} from '../packages/game-core/characters/registry.js';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {Button} from '../packages/game-core/types.js';
import {debugGeometry} from '../packages/game-core/combat/DebugGeometry.js';
import {contentVersion,assertCompatibleContent} from '../packages/shared/contentVersion.js';
import {applyDamage} from '../packages/game-core/combat/DamageSystem.js';
import {allowsMove} from '../packages/game-core/simulation/StateMachine.js';
import {validateAnimationManifest,validateAtlasFrames,attachmentOffset} from '../apps/client/src/rendering/AnimationContract.js';
import {RollbackManager} from '../packages/networking/RollbackManager.js';
const run=(g:GameSimulation,n:number,input=0)=>{for(let i=0;i<n;i++)g.step([input,0]);};
test('a newly registered fighter reuses timed spin, hose and juggling without core changes',()=>{
 const id='component-proof';registerCharacter({...characters.roms,id});
 try{
  for(const button of [Button.Special2,Button.Super1,Button.Super2]){
   const a=new GameSimulation(['roms','gut'],true),b=new GameSimulation([id,'gut'],true);
   for(const g of [a,b]){g.state.fighters[0].meter=100;g.state.fighters[1].x=g.state.fighters[0].x+130;}
   for(let i=0;i<1801;i++){
    const input=i===0?button:i%45===0?Button.Heavy:i%80<10?Button.Right:0;
    a.step([input,0]);b.step([input,0]);
    if(i%60===0){const snap=b.snapshot();snap.fighters[0].characterId='roms';assert.deepEqual(snap,a.snapshot());}
   }
  }
 }finally{delete characters[id];}
});
test('invalid ability references, timers and collision boxes fail before a match',()=>{
 const c={...characters.roms,moves:{...characters.roms.moves}};
 c.moves.chop={...c.moves.chop,returningProjectile:'missing'};assert.throws(()=>validateCharacter(c),/unknown returning path/);
 c.moves.chop={...characters.roms.moves.chop,periodicMelee:{interval:0,rangeX:10,rangeY:10,hitstun:2,push:1}};assert.throws(()=>validateCharacter(c),/interval/);
 c.moves.chop={...characters.roms.moves.chop,hitboxes:[{x:0,y:0,w:NaN,h:10}]};assert.throws(()=>validateCharacter(c),/collision/);
});
test('content compatibility detects changed gameplay data and rejects missing versions',()=>{
 const before=contentVersion();assert.doesNotThrow(()=>assertCompatibleContent(before));assert.throws(()=>assertCompatibleContent(undefined),/Refresh/);
 const damage=characters.roms.moves.chop.damage;
 try{characters.roms.moves.chop.damage++;assert.notEqual(contentVersion(),before);assert.throws(()=>assertCompatibleContent(before),/versions differ/);}
 finally{characters.roms.moves.chop.damage=damage;}
 assert.equal(contentVersion(),before);
});
test('shared damage preserves stacking, one rounding step, combo policy and training floor',()=>{
 const g=new GameSimulation(['roms','gut'],true),f=g.state.fighters[0];f.armorUntil=100;f.bloodMasterUntil=100;
 assert.equal(applyDamage(g.state,f,101,{combo:'hit'}),55);assert.equal(f.comboDamage,55);assert.equal(f.combo,1);
 f.health=1;applyDamage(g.state,f,999);assert.equal(f.health,1);assert.equal(f.combo,1);
});
test('damage diagnostics do not enter snapshots and rollback suppresses replay side effects',()=>{
 const g=new GameSimulation(['roms','gut'],true),[f,d]=g.state.fighters;d.x=f.x+120;f.meter=100;run(g,1,Button.Special2);run(g,29);
 assert.ok(g.gameplayEvents.some(e=>e.type==='DamageApplied'));
 const snap=g.snapshot(),hash=hashState(snap);g.clearPresentationEvents();assert.equal(hashState(g.snapshot()),hash);assert.equal(g.gameplayEvents.length,0);
 g.restore(snap);run(g,15);const expected=hashState(g.state);g.restore(snap);run(g,15);assert.equal(hashState(g.state),expected);
 const online=new GameSimulation(['roms','gut']);online.state.phase='fight';const rollback=new RollbackManager(online,0,0,8);
 for(let i=0;i<5;i++){rollback.schedule(0,()=>{});rollback.tick();}rollback.receive(0,Button.Right,1);
 assert.ok(rollback.rollbackCount>0);assert.equal(online.events.length,0);assert.equal(online.gameplayEvents.length,0);
});
test('debug geometry includes the actual beam and lower stance, projectiles and continuous attacks',()=>{
 const g=new GameSimulation(['roms','gut'],true),f=g.state.fighters[0];f.move='water';f.moveFrame=35;
 const shapes=debugGeometry(g.state,g.stage);assert.ok(shapes.some(b=>b.kind==='beam'&&b.h===38));assert.ok(shapes.some(b=>b.kind==='hurt'&&b.w>100));
 f.move='spin';f.moveFrame=20;assert.ok(debugGeometry(g.state,g.stage).some(b=>b.kind==='area'&&b.w===350));
});
test('animation validation reports missing states and attachment math preserves the nozzle',()=>{
 assert.throws(()=>validateAnimationManifest({frameCount:2,actions:{walk:[0]}},['dash']),/dash/);
 assert.throws(()=>validateAtlasFrames([[20,20,10,30]],64,64),/frame/);
 assert.doesNotThrow(()=>validateAtlasFrames([[0,0,30,40,15]],64,64));
 assert.deepEqual(attachmentOffset([0,0,100,100],[80,20],[1,1],.01),{x:.7,y:.7});
 const g=new GameSimulation(['roms','gut'],true),f=g.state.fighters[0];const m={...characters.roms.moves.chop,allowedStates:['Crouch']};assert.equal(allowsMove(f,m),false);f.state='Crouch';assert.equal(allowsMove(f,m),true);
});
test('six simultaneous modes remain bounded and replay to the same complete state',()=>{
 const g=new GameSimulation(Array(6).fill('roms'));g.state.phase='fight';g.state.fighters.forEach(f=>{f.state='Idle';f.meter=100;f.health=100000;});
 g.step(Array(6).fill(Button.Super1));
 for(let i=0;i<1000;i++)g.step(Array(6).fill(i%30===0?Button.Light:0));
 const snap=g.snapshot();for(let i=0;i<900;i++)g.step(Array(6).fill(0));const expected=hashState(g.state);
 g.restore(snap);for(let i=0;i<900;i++)g.step(Array(6).fill(0));assert.equal(hashState(g.state),expected);assert.ok(g.state.projectiles.length<=48);assert.ok(g.state.fighters.every(f=>!f.weaponUntil&&!f.modeFinaleUntil));
});

test('a roster of 20 additional definitions registers without engine changes',()=>{
 const ids=Array.from({length:20},(_,i)=>`roster-proof-${i}`);
 try{for(const id of ids)registerCharacter({...characters.roms,id});
  const g=new GameSimulation(ids.slice(0,6));g.state.phase='fight';g.step(Array(6).fill(0));assert.equal(g.state.fighters.length,6);assert.ok(Object.keys(characters).length>=26);
 }finally{ids.forEach(id=>delete characters[id]);}
});
