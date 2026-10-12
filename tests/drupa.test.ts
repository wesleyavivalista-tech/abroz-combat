import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {Button} from '../packages/game-core/types.js';
import {protectedDamage} from '../packages/game-core/simulation/HairSystem.js';
import {lightBeam,beamIntersects,advanceBeams} from '../packages/game-core/simulation/LightBeamSystem.js';
import {RollbackManager} from '../packages/networking/RollbackManager.js';
const m=characters.drupa.moves;
function match(n=2){const s=new GameSimulation(Array(n).fill('drupa'));s.state.phase='fight';s.state.fighters.forEach(f=>{f.state='Idle';f.meter=100;});return s;}
function run(s:GameSimulation,n:number,input=0){for(let i=0;i<n;i++)s.step([input,0,0,0,0,0]);}
test('Drupa basic chain ends in belly bump and heavy and swing are separate attacks',()=>{
 const s=match(),f=s.state.fighters[0];s.step([Button.Light,0]);assert.equal(f.move,'swing1');run(s,3);s.step([Button.Light,0]);run(s,15);assert.equal(f.move,'swing2');s.step([Button.Light,0]);run(s,20);assert.equal(f.move,'bellyFinish');run(s,70);s.step([Button.Medium,0]);assert.equal(f.move,'belly');run(s,80);s.step([Button.Heavy,0]);assert.equal(f.move,'wide');
});
test('belly dive requires double jump and stuns for exactly 120 simulation ticks',()=>{
 for(const double of [false,true]){const s=match(),f=s.state.fighters[0];f.y=300;f.state='Fall';f.airJumpUsed=double;s.step([Button.Medium,0]);assert.equal(f.move,double?'bellyDive':'air');}
 const s=match(),[a,b]=s.state.fighters;a.y=200;b.move='wide';s.hit(0,m.bellyDive,0,true,1);assert.equal(b.stun,120);s.state.hitstop=0;run(s,119);assert.equal(b.stun,1);run(s,1);assert.equal(b.stun,0);
});
test('rolling crosses the arena and hits each passed opponent only once',()=>{
 const s=match(3),[a,b,c]=s.state.fighters;a.x=100;b.x=800;c.x=1600;s.step([Button.Special,0,0]);run(s,230);assert.equal(a.x,s.stage.width-40);assert.ok(b.health<1500&&c.health<1500);assert.equal(b.comboDamage,0);assert.ok(b.health>=1085&&c.health>=1085);
});
test('White Buda lasts 26 seconds, reduces all incoming damage 70%, slows movement 20%, permits basics only',()=>{
 const s=match(),f=s.state.fighters[0];s.step([Button.Super2,0]);run(s,36);assert.equal(f.weaponUntil-s.state.frame,1560);assert.equal(protectedDamage(f,s.state.frame,100),30);run(s,30);
 const x=f.x;run(s,1,Button.Right);assert.ok(Math.abs(f.x-x-3.2)<1e-9);
 for(const input of [Button.Special,Button.Special2,Button.Super1,Button.Super2]){run(s,1);s.step([input,0]);assert.equal(f.move,null);}
 s.step([Button.Medium,0]);assert.equal(f.move,'budaForward');assert.equal(m.budaForward.startupFrames,60);
 f.weaponUntil=s.state.frame+1;run(s,1);assert.equal(f.weaponUntil,0);assert.equal(f.move,null);assert.equal(protectedDamage(f,s.state.frame,100),100);
});
test('heaven light waits one second, descends at the warning, and low kick replaces sky shot',()=>{
 const s=match(),[a,b]=s.state.fighters;a.x=300;b.x=630;a.weaponUntil=2000;s.step([Button.Medium,0]);run(s,59,Button.Medium);assert.equal(b.health,1500);run(s,1,Button.Medium);assert.ok(b.health<1500);
 const ray=lightBeam(a,s.stage.width)!;assert.equal(ray.width,300);assert.equal(ray.dy,-1);assert.ok(beamIntersects(ray,{x:610,y:340,w:60,h:150}));assert.equal(beamIntersects(ray,{x:900,y:0,w:60,h:150}),false);
 assert.equal(m.budaSky.beam,undefined);assert.equal(m.budaSky.level,'low');assert.ok(m.budaSky.hitboxes[0].y<30);
});
test('giant punches reach platform height and belly bump knocks farther',()=>{
 assert.equal(characters.drupa.weaponModifiers?.bodyScale,3);
 for(const id of ['budaSwing1','budaSwing2','budaFinish']){const box=m[id as keyof typeof m].hitboxes[0];assert.ok(box.y<494&&box.y+box.h>340);}
 assert.equal(m.belly.knockback,60.8);
 const s=match(),b=s.state.fighters[1];s.hit(0,m.bellyDive,0,true,1);assert.equal(b.dazed,true);s.state.hitstop=0;run(s,120);assert.equal(b.dazed,false);
});
test('steerable beam deals continuous damage for thirteen seconds without hitstop, stun or knockback',()=>{
 const s=match(),[a,b]=s.state.fighters;a.x=300;b.x=900;b.y=100;b.vy=0;
 s.step([Button.Super1,0]);run(s,40);b.y=100;b.vy=0;const hp=b.health;
 run(s,24);assert.ok(b.health<hp);assert.equal(s.state.hitstop,0);assert.equal(b.stun,0);assert.equal(b.vx,0);
 const y=a.y;run(s,30,Button.Up);assert.equal(a.beamAim,18);assert.equal(a.y,y);run(s,60,Button.Down);assert.equal(a.beamAim,-42);
 a.moveFrame=m.budaBeam.startupFrames+779;assert.ok(lightBeam(a,s.stage.width));run(s,1);assert.equal(lightBeam(a,s.stage.width),null);
});
test('beam respects teammates and invulnerability; giant state clears on knockout',()=>{
 const s=new GameSimulation(['drupa','drupa','drupa','drupa'],false,undefined,[0,1,0,1]);s.state.phase='fight';s.state.fighters.forEach((f,i)=>{f.state='Idle';f.x=300+i*200;});const [a,b,c,d]=s.state.fighters;a.move='bald';a.moveFrame=29;d.invulnerableUntil=100;s.step([0,0,0,0]);assert.ok(b.health<1500);assert.equal(c.health,1500);assert.equal(d.health,1500);a.weaponUntil=1000;a.health=0;run(s,1);assert.equal(a.weaponUntil,0);
});
test('Drupa beam aim, giant form and rolling converge after late online input',()=>{
 const a=match(),b=match(),rb=new RollbackManager(b,0,0,8);
 for(let frame=0;frame<580;frame++){
  const inputs=[frame===0?Button.Super1:frame>50&&frame<90?Button.Up:frame>90&&frame<150?Button.Down:0,frame===0?Button.Super2:frame===150?Button.Medium:0];
  a.step(inputs);rb.local.set(frame,inputs[0]);rb.tick();rb.receive(frame,inputs[1],1);
 }
 assert.equal(hashState(a.state),hashState(b.state));
});
test('giant punches damage a platform opponent while the low kick hits a grounded opponent',()=>{
 for(const [id,y] of [['budaSwing1',340],['budaSwing2',340],['budaFinish',340],['budaSky',0]] as const){
  const s=match(),[a,b]=s.state.fighters;a.x=500;b.x=730;b.y=y;a.weaponUntil=2000;a.move=id;a.moveFrame=m[id].startupFrames-1;a.state='LightAttack';b.state=y?'Idle':'Idle';
  run(s,1);const expected={budaSwing1:140,budaSwing2:161,budaFinish:217,budaSky:196};assert.equal(b.health,1500-expected[id],`${id} deals 40% more damage at height ${y}`);
 }
});
test('White Buda beam is wider, stronger and lasts thirteen seconds; low kick starts in twelve frames',()=>{
 assert.equal(m.budaBeam.activeFrames,13*60);assert.equal(m.budaBeam.beam?.width,55);assert.equal(m.budaBeam.damage,18);
 const s=match(),[a,b]=s.state.fighters;a.x=300;b.x=700;a.move='budaBeam';a.moveFrame=m.budaBeam.startupFrames-1;a.beamAim=0;
 run(s,1);assert.equal(b.health,1500-18);assert.equal(b.stun,0);
 assert.equal(m.budaSky.startupFrames,12);assert.equal(m.budaSky.recoveryFrames,18);
});
test('held sky beam keeps damaging without hitstop, ends on release, and cancels on transformation expiry',()=>{
 const s=match(),[a,b]=s.state.fighters;a.x=300;b.x=630;a.weaponUntil=2000;
 s.step([Button.Medium,0]);run(s,60,Button.Medium);const hp=b.health;
 run(s,36,Button.Medium);assert.equal(b.health,hp-3*34);assert.equal(s.state.hitstop,0);assert.equal(b.stun,0);assert.equal(b.vx,0);
 run(s,1);assert.equal(lightBeam(a,s.stage.width),null);const released=b.health;run(s,30);assert.equal(b.health,released);assert.equal(a.move,null);
 s.step([Button.Medium,0]);run(s,60,Button.Medium);a.weaponUntil=s.state.frame+1;run(s,1,Button.Medium);assert.equal(a.move,null);assert.equal(lightBeam(a,s.stage.width),null);
});
test('releasing sky beam during charge produces no beam or damage',()=>{
 const s=match(),[a,b]=s.state.fighters;a.x=300;b.x=630;a.weaponUntil=2000;s.step([Button.Medium,0]);run(s,30,Button.Medium);run(s,80);assert.equal(b.health,1500);assert.equal(a.move,null);
});
test('held beam and release replay identically through rollback',()=>{
 const a=match(),b=match();for(const s of [a,b]){s.state.fighters[0].x=300;s.state.fighters[1].x=630;s.state.fighters[1].weaponUntil=2000;}
 const rb=new RollbackManager(b,0,0,8);
 for(let frame=0;frame<200;frame++){const remote=frame<130?Button.Medium:0;a.step([0,remote]);rb.local.set(frame,0);rb.tick();rb.receive(frame,remote,1);}
 assert.equal(hashState(a.state),hashState(b.state));
});

test('only second basic after double jump selects belly dive; every other air basic is a kick',()=>{
 for(const double of [false,true])for(const button of [Button.Light,Button.Medium,Button.Heavy]){
  const s=match(),f=s.state.fighters[0];f.y=300;f.state='Fall';f.airJumpUsed=double;
  s.step([button,0]);assert.equal(f.move,double&&button===Button.Medium?'bellyDive':'air');
 }
 assert.equal(m.air.dive,undefined);assert.equal(m.air.damage,75);
});


test('ultimate beam rotates through 360 degrees in both directions without moving its origin',()=>{
 for(const facing of [1,-1] as const){
  const s=match(),f=s.state.fighters[0];f.x=1200;f.facing=facing;
  s.step([Button.Super1,0]);run(s,40);
  const y=f.y,initial=f.beamAim;
  for(const input of [Button.Up,Button.Down]){
   const seen=new Set<number>();
   for(let i=0;i<360;i++){
    run(s,1,input);seen.add(f.beamAim);
    const ray=lightBeam(f,s.stage.width)!;assert.ok(ray);
    assert.equal(ray.x,f.x);assert.equal(ray.y,y+80);
   }
   assert.equal(seen.size,360);assert.equal(f.beamAim,initial);
  }
 }
});

test('ultimate beam hits behind, above and below in either facing without extra damage pulses',()=>{
 for(const facing of [1,-1] as const)for(const angle of [0,90,-90,-180]){
  const s=match(),[f,d]=s.state.fighters;
  Object.assign(f,{x:1200,y:600,facing,move:'budaBeam',moveFrame:40,state:'SpecialMove',beamAim:angle});
  const ray=lightBeam(f,s.stage.width)!;
  d.x=ray.x+ray.dx*300;d.y=ray.y+ray.dy*300-70;
  const hp=d.health;advanceBeams(s.state,s.stage.width);assert.equal(d.health,hp-18);
  advanceBeams(s.state,s.stage.width);assert.equal(d.health,hp-18);assert.equal(d.stun,0);
 }
});

test('full-circle ultimate aiming converges after remote-input rollback',()=>{
 const a=match(),b=match(),rb=new RollbackManager(b,0,0,8);
 for(let frame=0;frame<790;frame++){
  const input=frame===0?Button.Super1:frame<410?Button.Up:Button.Down;
  a.step([0,input]);rb.local.set(frame,0);rb.tick();rb.receive(frame,input,1);
 }
 assert.ok(rb.rollbackCount>0);assert.equal(hashState(a.state),hashState(b.state));
});
