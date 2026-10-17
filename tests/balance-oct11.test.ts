import {test} from 'node:test';
import assert from 'node:assert/strict';
import {characters} from '../packages/game-core/characters/registry.js';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {Button} from '../packages/game-core/types.js';
import {damageMultiplier} from '../packages/game-core/combat/DamageSystem.js';
import {angerDamageMultiplier,angerMultiplier} from '../packages/game-core/simulation/AngerSystem.js';
import {activateNapa,cookieMonsterInput,sniffSuppresses} from '../packages/game-core/simulation/NapaSystem.js';
import {summonClones} from '../packages/game-core/simulation/HairSystem.js';
import {lightBeam,beamHitsFighter} from '../packages/game-core/simulation/LightBeamSystem.js';
import {hoseOrigin,hosePose} from '../packages/game-core/simulation/HoseAim.js';
const game=(ids=['napa','gut'])=>{const g=new GameSimulation(ids);g.state.phase='fight';g.state.fighters.forEach((f,i)=>Object.assign(f,{state:'Idle',meter:100,x:300+i*1700}));return g;};
const run=(g:GameSimulation,n:number,input=0)=>{for(let i=0;i<n;i++)g.step([input,0]);};
test('requested durations, health, damage and armor have exact values and expire',()=>{
 assert.equal(characters.nikalz.moves.jab.damage,45);
 assert.equal(characters.nikalz.moves.bees.damage,54);
 assert.equal(characters.roms.moves.juggle.weaponFrames,1560);
 assert.equal(characters.luizinho.moves.wall.structure!.duration,1200);
 assert.equal(characters.gut.stats.maxHealth,1500);
 assert.equal(characters.gut.moves.hug.grappleFrames,120);
 assert.equal(characters.fausto.moves.bravinho.angerFrames,2400);
 assert.equal(characters.fausto.moves.ancestry.weaponFrames,1800);
 const f=game(['fausto','gut']).state.fighters[0];
 f.angerUntil=100;f.angerStacks=3;
 assert.equal(angerDamageMultiplier(f,0),1.5);assert.equal(angerMultiplier(f,0),1.35);
 assert.equal(damageMultiplier(f,0),.9);f.weaponUntil=100;assert.equal(damageMultiplier(f,0),.81);
 assert.equal(damageMultiplier(f,100),1);
});
test('Flash Slash charges for exactly 60 simulation frames even in Samurai mode',()=>{
 const g=game(['fausto','gut']),f=g.state.fighters[0];f.weaponUntil=1000;
 g.step([Button.Medium,0]);const start=g.state.frame;
 run(g,59,Button.Medium);assert.equal(f.move,'flash');assert.equal(f.moveFrame,59);
 run(g,1,Button.Medium);assert.equal(g.state.frame-start,60);assert.equal(f.moveFrame,60);
});
test('Cookie Monster chases distant enemies instead of starting out-of-range melee',()=>{
 const g=game(),s=g.state;activateNapa(s,g.stage,s.fighters[0],0,characters.napa.moves.cookieMonster);
 const c=s.clones[0];assert.equal(c.maxHealth,1340);c.pattern=1;s.frame=100;
 assert.equal(cookieMonsterInput(s,c,g.stage),Button.Right);assert.equal(c.fighter.move,null);
 s.fighters[1].x=c.fighter.x+100;
 cookieMonsterInput(s,c,g.stage);assert.equal(c.fighter.move,'bossSlam');
});
test('Super Sniff prevents attacks, persists while held, consumes reduced energy and releases cleanly',()=>{
 const g=game(),[f,d]=g.state.fighters;d.x=1400;
 run(g,1,Button.Special2);run(g,20,Button.Special2);
 assert.equal(sniffSuppresses(g.state,d),true);
 for(let i=0;i<100;i++)g.step([Button.Special2,i%2?0:Button.Light]);
 assert.equal(d.move,null);assert.equal(f.move,'sniff');assert.ok(f.meter<75&&f.meter>=55);
 const snapshot=g.snapshot();run(g,50,Button.Special2);const hash=hashState(g.state);g.restore(snapshot);run(g,50,Button.Special2);assert.equal(hashState(g.state),hash);
 run(g,1);assert.equal(sniffSuppresses(g.state,g.state.fighters[1]),false);
 g.step([0,0]);g.step([0,Button.Light]);assert.equal(g.state.fighters[1].move,'palm');
});
test('Cookie and Power Chord lifetime covers a full stage and soundwave emits four directional waves',()=>{
 for(const [id,input,move] of [['napa',Button.Special,'cookie'],['dodo',Button.Special,'chord']] as const){
  const g=game([id,'gut']);g.stage={...g.stage,width:6000};g.state.fighters[1].x=5500;
  run(g,1,input);run(g,characters[id].moves[move].startupFrames);
  const p=g.state.projectiles.find(p=>p.active)!;assert.ok(p.soundWave?p.soundWave.range>=g.stage.width:p.life*Math.abs(p.vx)>=g.stage.width);
 }
 const g=game(['dodo','gut']),f=g.state.fighters[0];f.weaponUntil=1000;f.y=400;f.state='Fall';
 run(g,1,Button.Light);run(g,60,Button.Light);
 const waves=g.state.projectiles.filter(p=>p.active&&p.move==='starWave');
 assert.equal(waves.length,4);assert.ok(waves[0].soundWave?.continuous);assert.deepEqual(waves.map(p=>[p.vx,p.vy]),[[18,0],[-18,0],[0,18],[0,-18]]);
 run(g,5,Button.Light);assert.equal(g.state.projectiles.filter(p=>p.active&&p.move==='starWave'&&p.soundWave?.generation===0).length,4);
});
test('basketball companions move and animate 15 percent slower without slowing Dodo',()=>{
 const g=game(['dodo','gut']),f=g.state.fighters[0];summonClones(g.state,0,g.stage);const c=g.state.clones[0].fighter;
 const x=c.x;g.updateFighter(c,Button.Right,0);assert.ok(Math.abs((c.x-x)-4.25)<=.051,'movement keeps existing 0.1-unit coordinate rounding');
 const ownerX=f.x;g.updateFighter(f,Button.Right,0);assert.equal(f.x-ownerX,5);
 c.move='ball';c.moveFrame=0;c.speedRemainder=0;c.state='HeavyAttack';
 for(let i=0;i<20;i++)g.updateFighter(c,0,0);assert.equal(c.moveFrame,17);
});
test('hose traverses 360 degrees with shared full-body pose/nozzle anchors and hits behind',()=>{
 const g=game(['roms','gut']),[f,d]=g.state.fighters;f.move='water';f.moveFrame=31;f.state='SpecialMove';f.actionUntil=1000;
 for(const angle of [0,45,90,135,180,225,270,315]){
  f.beamAim=angle;const ray=lightBeam(f,g.stage.width)!;const origin=hoseOrigin(angle);
  assert.equal(ray.x,f.x+origin.x);assert.equal(ray.y,f.y+origin.y);assert.equal(hosePose(angle),angle/22.5);
 }
 f.beamAim=179;run(g,1,Button.Up);assert.equal(f.beamAim,-180);
 f.x=1000;d.x=650;f.beamAim=-180;assert.equal(beamHitsFighter(lightBeam(f,g.stage.width)!,d),true);
});
test('Cool Muscles drain is 70 percent lower and ends safely at exhaustion',()=>{
 const g=game(['jomp','gut']),f=g.state.fighters[0];g.step([Button.Special,0]);const meter=f.meter;
 run(g,50,Button.Special);assert.ok(Math.abs(f.meter-(meter-3))<.00001);
 f.meter=.2;run(g,5,Button.Special);assert.equal(f.meter,0);assert.equal(f.move,null);
});

test('Sniff stops on exhaustion or caster death, preserves execution armor and does not let monsters attack',()=>{
 for(const end of ['energy','death']){
  const g=game(),[f,d]=g.state.fighters;d.x=1000;g.step([Button.Special2,0]);run(g,20,Button.Special2);
  assert.ok(sniffSuppresses(g.state,d));
  if(end==='energy')f.meter=0;else f.health=0;
  run(g,1,Button.Special2);assert.equal(sniffSuppresses(g.state,d),false);
 }
 const g=game(['napa','napa']),[f,d]=g.state.fighters;d.x=1000;
 f.move='sniff';f.moveFrame=30;f.state='SpecialMove';
 d.move='cookie';d.state='SpecialMove';d.moveFrame=0;assert.equal(sniffSuppresses(g.state,d),false);
 d.move=null;d.state='Idle';activateNapa(g.state,g.stage,d,1,characters.napa.moves.cookieMonster);
 const c=g.state.clones[0];g.state.frame=100;assert.equal(cookieMonsterInput(g.state,c,g.stage),0);assert.equal(c.fighter.move,null);
});
