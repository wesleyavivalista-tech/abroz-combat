import test from 'node:test';
import assert from 'node:assert/strict';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {Button} from '../packages/game-core/types.js';
import {activateNapa,advanceNapa,dropMonsterCookies,cookieMonsterInput} from '../packages/game-core/simulation/NapaSystem.js';
import {attackSlow,movementSlow} from '../packages/game-core/simulation/BloodSystem.js';
function game(){const g=new GameSimulation(['napa','gut']);g.state.phase='fight';g.state.fighters.forEach(f=>{f.state='Idle';f.meter=100;});g.state.fighters[0].x=300;g.state.fighters[1].x=1800;return g;}
const run=(g:GameSimulation,n:number)=>{for(let i=0;i<n;i++)g.step([0,0]);};
test('Napa bakes for 180 frames before monster becomes an active actor',()=>{const g=game();g.step([Button.Super1,0]);run(g,179);assert.equal(g.state.clones.length,0);run(g,1);assert.equal(g.state.clones.length,1);const c=g.state.clones[0];assert.equal(c.fighter.health,1040);assert.equal(c.kind,'cookie-monster');assert.equal(c.fighter.cookieBoss,true);assert.equal(c.fighter.move,null);});
test('death during baking never spawns a delayed monster',()=>{const g=game(),[f,d]=g.state.fighters;g.step([Button.Super1,0]);run(g,100);f.health=1;g.hit(1,characters.gut.moves.palm,0,false,0,-1,d,f);assert.equal(f.health,0);run(g,220);assert.equal(f.move,null);assert.equal(g.state.clones.length,0);});
test('Cookie Monster cycles a slow barrage, slam and chomp with recovery gaps',()=>{const g=game(),s=g.state;activateNapa(s,g.stage,s.fighters[0],0,characters.napa.moves.cookieMonster);const c=s.clones[0];s.frame=45;cookieMonsterInput(s,c,g.stage);assert.equal(c.fighter.move,'bossBarrage');activateNapa(s,g.stage,c.fighter,0,characters.napa.moves.bossBarrage);assert.equal(s.projectiles.filter(p=>p.active).length,5);assert.ok(s.projectiles.some(p=>(p.bounces??0)>0));assert.ok(s.projectiles.some(p=>p.vx<0));for(const move of ['bossSlam','bossChomp','bossBarrage']){c.fighter.move=null;c.fighter.state='Idle';s.frame=c.nextAction!;cookieMonsterInput(s,c,g.stage);assert.equal(c.fighter.move,move);assert.ok(c.nextAction!>s.frame+100);}});
test('monster defeat yields exactly five deterministic persistent drops; Napa heals and enemy is poisoned',()=>{const a=game(),b=game();for(const g of [a,b]){activateNapa(g.state,g.stage,g.state.fighters[0],0,characters.napa.moves.cookieMonster);g.state.clones[0].fighter.health=0;dropMonsterCookies(g.state,g.stage);dropMonsterCookies(g.state,g.stage);}assert.equal(hashState(a.state),hashState(b.state));const drops=a.state.hazards.filter(h=>h.kind==='cookie-drop');assert.equal(drops.length,5);assert.ok(drops.every(h=>h.expiresAt===Number.MAX_SAFE_INTEGER));const [f,d]=a.state.fighters;f.health=1000;f.x=drops[0].x;f.y=drops[0].y;advanceNapa(a.state,a.stage);assert.equal(f.health,1070);d.x=drops[1].x;d.y=drops[1].y;advanceNapa(a.state,a.stage);assert.equal(d.poisonUntil,a.state.frame+300);assert.equal(a.state.hazards.filter(h=>h.kind==='cookie-drop').length,3);});
test('Mega Sneeze slows enemy movement and attacks to 30 percent for 85 seconds, owner immune',()=>{const g=game(),s=g.state,[f,d]=s.fighters;activateNapa(s,g.stage,f,0,characters.napa.moves.sneeze);const h=s.hazards[0];assert.equal(h.expiresAt-s.frame,5100);d.x=h.x;d.y=h.y;advanceNapa(s,g.stage);assert.equal(attackSlow(d,s.frame),.3);assert.equal(movementSlow(d,s.frame),.3);assert.equal(f.areaSlow,1);d.x=1800;run(g,1);assert.equal(d.areaSlow,1);s.frame=h.expiresAt;advanceNapa(s,g.stage);assert.equal(s.hazards.length,0);});
test('sniff pulls nearby enemies and ends when interrupted',()=>{const g=game(),[f,d]=g.state.fighters;d.x=f.x+300;g.step([Button.Special2,0]);run(g,25);assert.ok(d.x<f.x+300);const x=d.x;f.move=null;run(g,4);assert.equal(d.x,x);});
test('Napa rollback replays summon and autonomous boss state exactly',()=>{const g=game();g.step([Button.Super1,0]);run(g,130);const saved=structuredClone(g.state);run(g,400);const hash=hashState(g.state);g.state=structuredClone(saved);run(g,400);assert.equal(hashState(g.state),hash);});
test('round reset removes monster, snot, cookies and projectiles',()=>{const g=game(),s=g.state,f=s.fighters[0];activateNapa(s,g.stage,f,0,characters.napa.moves.cookieMonster);activateNapa(s,g.stage,f,0,characters.napa.moves.sneeze);s.clones[0].fighter.health=0;dropMonsterCookies(s,g.stage);g.resetPositions();assert.equal(s.clones.length,0);assert.equal(s.hazards.length,0);assert.ok(s.projectiles.every(p=>!p.active));assert.equal(s.fighters[0].cookieBoss,undefined);});
test('monster survives owner life loss without death drops and baked drops survive owner respawn',()=>{const g=game(),s=g.state,f=s.fighters[0];activateNapa(s,g.stage,f,0,characters.napa.moves.cookieMonster);f.health=0;run(g,1);assert.equal(s.clones.length,1);assert.equal(s.hazards.length,0);run(g,121);s.clones[0].fighter.health=0;dropMonsterCookies(s,g.stage);s.fighters[0].x=0;s.fighters[0].health=0;run(g,1);assert.equal(s.hazards.filter(h=>h.kind==='cookie-drop').length,5);});
test('sniff pulls from left, right, above and below with the same reach; allies and distant actors stay put',()=>{
 for(const [dx,dy] of [[300,0],[-300,0],[0,300],[0,-300],[210,210]]){
  const g=game(),[f,d]=g.state.fighters;f.x=1000;f.y=500;f.move='sniff';f.moveFrame=30;d.x=f.x+dx;d.y=f.y+dy;
  const before=Math.abs(dx)+Math.abs(dy);advanceNapa(g.state,g.stage);assert.ok(Math.abs(d.x-f.x)+Math.abs(d.y-f.y)<before,`${dx},${dy}`);
 }
 const g=game(),[f,d]=g.state.fighters;f.x=1000;f.move='sniff';f.moveFrame=30;d.x=700;g.state.teams[1]=g.state.teams[0];advanceNapa(g.state,g.stage);assert.equal(d.x,700);
 g.state.teams[1]=99;d.x=1500;advanceNapa(g.state,g.stage);assert.equal(d.x,1500);
 d.x=700;d.invulnerableUntil=100;advanceNapa(g.state,g.stage);assert.equal(d.x,700);
});
test('enlarged snot covers the new width and thickness while remaining inside arena bounds',()=>{
 const g=game(),s=g.state,[f,d]=s.fighters;f.x=g.stage.width-40;activateNapa(s,g.stage,f,0,characters.napa.moves.sneeze);const h=s.hazards[0];assert.equal(h.width,720);assert.equal(h.height,56);assert.ok(h.x+h.width!/2<=g.stage.width);assert.equal(h.expiresAt-s.frame,5100);
 d.x=h.x-340;d.y=h.y+45;advanceNapa(s,g.stage);assert.equal(d.areaSlow,.3);
 d.areaSlow=1;d.x=h.x-400;advanceNapa(s,g.stage);assert.equal(d.areaSlow,1);
});

test('enemy Napa cannot heal from another team’s monster cookies; allied Napa can',()=>{
 for(const teams of [[0,1,0,1],[0,0,1,1]]){
  const g=new GameSimulation(['napa','napa','gut','gut'],false,undefined,teams);g.state.phase='fight';
  const [owner,picker]=g.state.fighters;owner.state=picker.state='Idle';owner.x=100;picker.x=700;picker.y=0;picker.health=1000;
  g.state.hazards.push({kind:'cookie-drop',owner:0,x:700,y:0,createdAt:0,expiresAt:Number.MAX_SAFE_INTEGER,move:'cookieMonster',nextTicks:[]});
  advanceNapa(g.state,g.stage);
  assert.equal(picker.health,teams[1]===0?1070:1000);
  assert.equal(picker.poisonUntil,teams[1]===0?0:g.state.frame+300);
  assert.equal(g.state.hazards.length,0);
 }
});
