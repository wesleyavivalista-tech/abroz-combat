import { test } from "node:test";
import assert from "node:assert/strict";
import { GameSimulation, hashState } from "../packages/game-core/simulation/GameSimulation.js";
import { Button } from "../packages/game-core/types.js";
import { characters } from "../packages/game-core/characters/registry.js";
import { advanceStatuses, igniteTarget } from "../packages/game-core/simulation/StatusSystem.js";
import { tochaPose } from "../apps/client/src/rendering/TochaRenderer.js";
import { RollbackManager } from "../packages/networking/RollbackManager.js";
const moves = characters.tocha.moves;
function match(n = 2) {
  const sim = new GameSimulation(Array(n).fill("tocha"), false, undefined, n === 2 ? [0, 1] : Array.from({length:n}, (_, i) => i % 2));
  sim.state.phase = "fight"; sim.state.fighters.forEach(f => f.state = "Idle"); return sim;
}
function run(sim: GameSimulation, n: number, mask = 0) { for(let i=0;i<n;i++) sim.step([mask,0,0,0,0,0]); }
test("Tocha has two skins, punch/punch/kick chain, heavy kick and burning double punch", () => {
  assert.equal(characters.tocha.skins?.length, 2);
  const s=match(), f=s.state.fighters[0];
  s.step([Button.Light,0]); assert.equal(f.move,"jab"); run(s,3); s.step([Button.Light,0]); run(s,10); assert.equal(f.move,"cross");
  s.step([Button.Light,0]); run(s,14); assert.equal(f.move,"finisher");
  run(s,50); s.step([Button.Medium,0]); assert.equal(f.move,"heavy"); run(s,60);
  s.step([Button.Heavy,0]); assert.equal(f.move,"double"); assert.equal(moves.double.burn?.duration,180);
});
test("burn ticks for exactly 3/4 seconds during movement and hitstop without stun", () => {
  for(const duration of [180,240]) {
    const s=match(), target=s.state.fighters[0];
    igniteTarget(s.state,target,1,duration,10);
    const x=target.x; run(s,29,Button.Left); assert.equal(target.health,1400); assert.ok(target.x<x); assert.equal(target.stun,0);
    s.state.hitstop=300; run(s,duration-29); assert.equal(target.health,1400-duration/30*10);
    run(s,1); assert.equal(target.burnUntil,0); run(s,60); assert.equal(target.health,1400-duration/30*10);
  }
});
test("blocked and invulnerable targets cannot ignite; double punch and fireball burn on hit", () => {
  const s=match(), [a,b]=s.state.fighters;
  s.hit(0,moves.double,Button.Right,false,1); assert.equal(b.burnUntil,0); assert.equal(b.health,1400-Math.ceil(moves.double.damage*.4));
  b.stun=0;b.state="Idle";s.hit(0,moves.double,0,false,1); assert.equal(b.burnUntil,s.state.frame+180);
  b.burnUntil=0;b.invulnerableUntil=200;igniteTarget(s.state,b,0,180,10); assert.equal(b.burnUntil,0);
  const ball=match();ball.state.fighters[0].x=600;ball.state.fighters[1].x=900;ball.step([Button.Special,0]);run(ball,50);assert.ok(ball.state.fighters[1].burnUntil>ball.state.frame);
  assert.ok(a.meter>40);
});
test("ground sigil persists 8 seconds, is repeatable and damages only nearby enemies on same level", () => {
  const s=match(4);s.state.fighters.forEach((f,i)=>{f.x=1000+i*80;});
  s.step([Button.Special2,0,0,0]);run(s,24); assert.equal(s.state.hazards.length,1);
  const h=s.state.hazards[0], expiry=h.expiresAt;assert.equal(expiry-s.state.frame,480);
  s.state.fighters[2].x=1000; s.state.fighters[3].x=1000;s.state.fighters[3].y=340;
  run(s,1);assert.equal(s.state.fighters[1].health,1382);assert.equal(s.state.fighters[2].health,1400);assert.equal(s.state.fighters[3].health,1400);
  s.state.hitstop=300;run(s,expiry-s.state.frame-1);assert.equal(s.state.hazards.length,1);run(s,1);assert.equal(s.state.hazards.length,0);
});
test("On fire lasts 33 seconds, refreshes contact burn and boosts movement/attack speed by 50%", () => {
  const s=match(), f=s.state.fighters[0]; f.meter=100;s.step([Button.Super1,0]);run(s,18);
  assert.equal(f.onFireUntil-s.state.frame,1980);assert.equal(f.meter,0);run(s,30);
  const x=f.x;run(s,10,Button.Right);assert.equal(f.x-x,75);
  s.step([Button.Light,0]);run(s,3);assert.equal(f.moveFrame,5); // 4 ticks advance 6 animation frames from -1
  f.move=null;f.state="Idle";s.state.fighters[1].x=f.x+64;run(s,35);const d=s.state.fighters[1];assert.ok(d.health<1400);assert.ok(d.burnUntil>=s.state.frame+239);
  const expiry=f.onFireUntil;s.state.hitstop=2000;run(s,expiry-s.state.frame);assert.equal(f.onFireUntil,0);
});
test("each Tocha super requires full energy and remains spent through death and respawn", () => {
  for(const button of [Button.Super1,Button.Super2]) {
    const s=match(),f=s.state.fighters[0]; f.meter=99;s.step([button,0]);assert.equal(f.move,null);run(s,10);
    f.meter=100;s.step([button,0]);assert.equal(f.usedSupers.length,1);assert.equal(f.meter,0);
    f.health=0;run(s,1);assert.equal(f.onFireUntil,0);assert.equal(f.burnUntil,0);run(s,120);
    f.meter=100;s.step([button,0]);assert.equal(f.move,null);assert.equal(f.usedSupers.length,1);
  }
});
test("666 Satan headbangs, launches one large homing pentagram and deals high damage", () => {
  const s=match(),[f,d]=s.state.fighters;f.meter=100;f.x=500;d.x=950;
  s.step([Button.Super2,0]);run(s,20);assert.ok([16,17].includes(tochaPose(f,characters.tocha)));
  run(s,70);assert.equal(s.state.projectiles.filter(p=>p.active).length,1);
  run(s,45);assert.equal(d.health,1040);assert.equal(f.meter,0);
});
test("fire effects clear on defeat and cannot bypass respawn protection", () => {
  const s=match(),f=s.state.fighters[0];f.health=10;igniteTarget(s.state,f,1,180,10);f.onFireUntil=1000;
  run(s,30);assert.equal(f.lives,2);assert.equal(f.burnUntil,0);assert.equal(f.onFireUntil,0);
  run(s,120);igniteTarget(s.state,f,1,180,10);assert.equal(f.burnUntil,0);assert.equal(f.health,1400);
});
test("team fire, aura and sigils never damage teammates, and all status state replays identically", () => {
  const s=match(6);const [f,enemy,ally]=s.state.fighters;f.x=1000;enemy.x=1065;ally.x=1000;f.onFireUntil=600;
  igniteTarget(s.state,ally,0,180,10);assert.equal(ally.burnUntil,0);run(s,40);assert.equal(ally.health,1400);assert.ok(enemy.health<1400);
  const snap=s.snapshot();run(s,200);const hash=hashState(s.state);s.restore(snap);run(s,200);assert.equal(hashState(s.state),hash);
});
test("late online fire inputs converge through rollback in 2v2 and 3v3", () => {
  for(const n of [4,6]) {
    const baseline=match(n), predicted=match(n);for(const sim of [baseline,predicted]) sim.state.fighters.forEach((f,i)=>{f.x=500+i*90;f.meter=100;});
    const rb=new RollbackManager(predicted,0,0,8);
    for(let frame=0;frame<250;frame++) {
      const masks=Array.from({length:n},(_,seat)=>frame===0 ? seat%2 ? Button.Special : Button.Super1 : frame===70 ? Button.Special2 : 0);
      baseline.step(masks);rb.local.set(frame,masks[0]);rb.tick();
      for(let seat=1;seat<n;seat++) rb.receive(frame,masks[seat],seat);
    }
    assert.equal(hashState(predicted.state),hashState(baseline.state));
  }
});

test("recasting a pentagram does not shorten the existing sigil lifetime", () => {
  const s=match();s.state.fighters[0].meter=100;s.step([Button.Special2,0]);run(s,60);const firstExpiry=s.state.hazards[0].expiresAt;
  s.step([Button.Special2,0]);run(s,24);assert.equal(s.state.hazards.length,2);assert.equal(s.state.hazards[0].expiresAt,firstExpiry);
});

test('666 Satan inflicts a twelve-second purple burn with double normal tick damage',()=>{
 const s=match(),target=s.state.fighters[1];
 s.hit(0,moves.satan,0,false,1);
 assert.equal(target.burnKind,'purple');assert.equal(target.burnUntil,720);assert.equal(target.burnDamage,20);
 const hp=target.health;s.state.hitstop=0;
 run(s,29);assert.equal(target.health,hp);run(s,1);assert.equal(target.health,hp-20);
 run(s,690);assert.equal(target.health,hp-480);
 run(s,1);assert.equal(target.burnUntil,0);assert.equal(target.burnKind,'normal');
 igniteTarget(s.state,target,0,180,10);assert.equal(target.burnDamage,10);assert.equal(target.burnKind,'normal');
});

test('normal fire cannot dilute or prolong purple fire; it still respects guard, teams and respawns',()=>{
 const s=match(),target=s.state.fighters[1];
 igniteTarget(s.state,target,0,180,10);run(s,10);
 s.hit(0,moves.satan,0,false,1);const expiry=target.burnUntil,next=target.burnNextTick;
 igniteTarget(s.state,target,0,900,10);
 assert.equal(target.burnKind,'purple');assert.equal(target.burnUntil,expiry);assert.equal(target.burnDamage,20);assert.equal(target.burnNextTick,next);
 target.health=0;run(s,1);assert.equal(target.burnKind,'normal');assert.equal(target.burnUntil,0);
 for(const mode of ['block','immune','ally']){
  const t=match(mode==='ally'?4:2),seat=mode==='ally'?2:1,d=t.state.fighters[seat];
  if(mode==='immune')d.invulnerableUntil=100;
  t.hit(0,moves.satan,mode==='block'?Button.Right:0,false,seat);
  assert.equal(d.burnUntil,0);assert.equal(d.burnKind,'normal');
 }
});

test('purple super projectile and burn state converge through delayed online inputs',()=>{
 for(const n of [4,6]){
  const a=match(n),b=match(n);
  for(const s of [a,b])s.state.fighters.forEach((f,i)=>{f.x=500+i*180;f.meter=100;});
  const rb=new RollbackManager(b,0,0,8);
  for(let frame=0;frame<210;frame++){
   const inputs=Array(n).fill(0);if(frame===0)inputs[1]=Button.Super2;
   a.step(inputs);rb.local.set(frame,inputs[0]);rb.tick();
   for(let seat=1;seat<n;seat++)rb.receive(frame,inputs[seat],seat);
  }
  assert.ok(a.state.fighters.some(f=>f.burnKind==='purple'&&f.burnUntil>a.state.frame));
  assert.equal(hashState(a.state),hashState(b.state));
 }
});

test('third combo strike burns for three seconds on a clean hit but not through guard',()=>{
 for(const blocked of [false,true]){
  const s=match(),d=s.state.fighters[1];
  s.hit(0,moves.finisher,blocked?Button.Right:0,false,1);
  assert.equal(d.burnUntil,blocked?0:180);
  if(!blocked){const hp=d.health;s.state.hitstop=200;run(s,180);assert.equal(d.health,hp-60);run(s,1);assert.equal(d.burnUntil,0);}
 }
});

 test('pentagram ignites grounded enemies, refreshes without stacking and burns after leaving',()=>{
  const s=match(4);s.state.fighters.forEach((f,i)=>{f.x=1000;f.y=0;if(i===3)f.invulnerableUntil=1000;});
  s.step([Button.Special2,0,0,0]);run(s,24);
  const [caster,enemy,ally,immune]=s.state.fighters;
  const h=s.state.hazards[0];s.state.fighters.forEach(f=>{f.x=h.x;f.y=h.y;});s.state.frame++;advanceStatuses(s.state);
  assert.equal(enemy.burnKind,'normal');assert.equal(enemy.burnDamage,10);assert.equal(enemy.burnUntil,s.state.frame+240);
  assert.equal(caster.burnUntil,0);assert.equal(ally.burnUntil,0);assert.equal(immune.burnUntil,0);
  const next=enemy.burnNextTick;s.state.frame++;advanceStatuses(s.state);
  assert.equal(enemy.burnNextTick,next);assert.equal(enemy.burnUntil,s.state.frame+240);
  enemy.x=1800;const hp=enemy.health,expiry=enemy.burnUntil;
  s.state.frame=next;advanceStatuses(s.state);assert.equal(enemy.health,hp-10);assert.equal(enemy.burnUntil,expiry);
  s.state.frame=expiry+1;advanceStatuses(s.state);assert.equal(enemy.burnUntil,0);
 });
