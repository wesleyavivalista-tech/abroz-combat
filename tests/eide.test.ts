import test from 'node:test';
import assert from 'node:assert/strict';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {Button} from '../packages/game-core/types.js';
import {activateEide,advanceEide,nextAppliance,inLove} from '../packages/game-core/simulation/EideSystem.js';
import {resolveHit} from '../packages/game-core/combat/CombatSystem.js';
import {applyDamage} from '../packages/game-core/combat/DamageSystem.js';
const game=()=>{const g=new GameSimulation(['eide','gut']);g.state.phase='fight';g.state.fighters.forEach(f=>{f.state='Idle';f.meter=100;});return g;};
const run=(g:GameSimulation,n:number,input=0)=>{for(let i=0;i<n;i++)g.step([input,0]);};
test('appliance selection covers ten objects, replays deterministically and is not a fixed cycle',()=>{const g=game(),f=g.state.fighters[0],snap=g.snapshot();const a=Array.from({length:100},(_,i)=>nextAppliance(f,i,0));assert.equal(new Set(a).size,10);assert.ok(a.some((v,i)=>i&&v!==(a[i-1]+1)%10));g.restore(snap);assert.deepEqual(Array.from({length:100},(_,i)=>nextAppliance(g.state.fighters[0],i,0)),a);});
test('Seller travels straight and Bahia follows an upward then downward arc',()=>{for(const move of ['seller','bahia']){const g=game(),f=g.state.fighters[0];f.facing=-1;activateEide(g.state,g.stage,f,0,characters.eide.moves[move]);const p=g.state.projectiles.find(p=>p.active)!;assert.equal(p.vx<0,true);const y=p.y;run(g,12);assert.equal(move==='seller'?p.y===y:p.y>y,true);if(move==='bahia'){run(g,30);assert.ok(p.vy!<0);}}});
test('both throws hit enemies, knock them back and cost 25 energy',()=>{for(const button of [Button.Special,Button.Special2]){const g=game(),f=g.state.fighters[0],d=g.state.fighters[1];f.x=400;d.x=button===Button.Special?700:1100;const hp=d.health;g.step([button,0]);run(g,120);assert.equal(f.meter>=75,true);assert.equal(hp-d.health,button===Button.Special?85:170);assert.ok(d.x>(button===Button.Special?700:1100));}});
test('Love summons distinct 400 HP NPCs at opposite edges; they walk, ascend and stay on platforms',()=>{
 const g=game(),f=g.state.fighters[0];activateEide(g.state,g.stage,f,0,characters.eide.moves.love);
 assert.deepEqual(g.state.clones.map(c=>c.variant),[0,1]);
 assert.deepEqual(g.state.clones.map(c=>c.fighter.x),[24,g.stage.width-24]);
 assert.ok(g.state.clones.every(c=>c.fighter.health===400&&c.maxHealth===400&&c.fighter.y===g.stage.floorHeight));
 run(g,20);assert.equal(g.state.clones[0].fighter.x,104);assert.equal(g.state.clones[1].fighter.x,g.stage.width-104);
 assert.ok(g.state.clones.every(c=>c.fighter.state==='WalkForward'));
 run(g,70);assert.ok(g.state.clones.every(c=>c.fighter.y>g.stage.floorHeight&&c.fighter.state==='Jump'));
 run(g,130);const positions=g.state.clones.map(c=>[c.fighter.x,c.fighter.y]);
 assert.deepEqual(positions,g.stage.platforms!.map(p=>[p.x+p.width/2,p.y]));
 assert.ok(g.state.clones.every(c=>!c.fighter.npcEntrance&&c.fighter.state==='Idle'));
 run(g,90);assert.deepEqual(g.state.clones.map(c=>[c.fighter.x,c.fighter.y]),positions);assert.ok(inLove(f));
});
test('Love remains after one NPC dies and ends on the second death; defeat art gets 36 frames',()=>{const g=game(),f=g.state.fighters[0];activateEide(g.state,g.stage,f,0,characters.eide.moves.love);g.state.clones[0].fighter.health=0;g.step([0,0]);assert.ok(inLove(f));assert.equal(g.state.clones.length,2);g.state.clones[1].fighter.health=0;g.step([0,0]);assert.equal(inLove(f),false);run(g,37);assert.equal(g.state.clones.length,0);});
test('Love gives exact defense, movement and damage bonuses',()=>{const a=game(),b=game(),f=a.state.fighters[0];activateEide(a.state,a.stage,f,0,characters.eide.moves.love);applyDamage(a.state,f,100);assert.equal(f.health,1320);const x=f.x;const bx=b.state.fighters[0].x;run(a,1,Button.Right);run(b,1,Button.Right);assert.equal(f.x-x,(b.state.fighters[0].x-bx)*1.4);resolveHit(a.state,a.stage,()=>{},0,characters.eide.moves.jab,0,false,1);assert.equal(a.state.fighters[1].health,characters.gut.stats.maxHealth-72);});
test('NPCs react to damage without moving or attacking and ignore allied damage contacts',()=>{const g=game();activateEide(g.state,g.stage,g.state.fighters[0],0,characters.eide.moves.love);run(g,220);const d=g.state.clones[0].fighter,x=d.x,y=d.y;resolveHit(g.state,g.stage,()=>{},1,characters.gut.moves[characters.gut.basicAttacks!.heavy],0,false,0,1,undefined,d);advanceEide(g.state);assert.equal(d.state,'HitStunStanding');run(g,25);assert.equal(d.x,x);assert.equal(d.y,y);assert.equal(d.move,null);const hp=d.health;resolveHit(g.state,g.stage,()=>{},0,characters.eide.moves.heavyKick,0,false,0,1,undefined,d);assert.equal(d.health,hp);});
test('mutant startup, 20-second expiry, three direct attacks and no specials',()=>{const g=game(),f=g.state.fighters[0];g.step([Button.Super2,0]);run(g,90);assert.equal(f.weaponUntil,g.state.frame+1200);run(g,20);for(const [button,name] of [[Button.Light,'giantPunch'],[Button.Medium,'charge'],[Button.Heavy,'flyingKick']] as const){f.move=null;f.state='Idle';f.buffer=[];f.previousInput=0;g.step([button,0]);assert.equal(f.move,name);}f.move=null;f.state='Idle';f.buffer=[];g.step([Button.Special,0]);assert.equal(f.move,null);const end=f.weaponUntil;g.state.hitstop=1500;run(g,end-g.state.frame);assert.equal(f.weaponUntil,0);});
test('mutant damage is 80% higher and movement 40% slower; love is suspended while mutant',()=>{const g=game(),f=g.state.fighters[0];f.weaponUntil=1300;f.loveMode=true;assert.equal(inLove(f),false);const x=f.x;run(g,1,Button.Right);assert.equal(f.x-x,3);resolveHit(g.state,g.stage,()=>{},0,characters.eide.moves.giantPunch,0,false,1);assert.equal(g.state.fighters[1].health,characters.gut.stats.maxHealth-198);});
test('Eide random throws and companions replay exactly after restoring a snapshot',()=>{const g=game();activateEide(g.state,g.stage,g.state.fighters[0],0,characters.eide.moves.love);const snap=g.snapshot();const play=()=>{for(let i=0;i<400;i++){if(i%80===0)g.state.fighters[0].meter=100;g.step([i%80===0?Button.Special2:0,0]);}};play();const h=hashState(g.state);g.restore(snap);play();assert.equal(hashState(g.state),h);});
test('Love dash covers three times the normal dash distance',()=>{const a=game(),b=game();activateEide(a.state,a.stage,a.state.fighters[0],0,characters.eide.moves.love);for(const g of [a,b]){g.state.fighters[0].x=350;g.state.fighters[1].x=2300;g.step([Button.Right,0]);g.step([0,0]);g.step([Button.Right,0]);}assert.equal(a.state.fighters[0].state,'DashForward');assert.equal(a.state.fighters[0].vx,b.state.fighters[0].vx*3);});
test('Eide final KO clears Love Mode and summons',()=>{const g=game();activateEide(g.state,g.stage,g.state.fighters[0],0,characters.eide.moves.love);g.state.fighters[0].lives=1;g.state.fighters[0].health=0;g.step([0,0]);assert.equal(g.state.fighters[0].loveMode,undefined);assert.equal(g.state.clones.length,0);});
test('all six players can use Eide with independent summons and seeded projectiles',()=>{const g=new GameSimulation(Array(6).fill('eide'));g.state.phase='fight';g.state.fighters.forEach((f,i)=>{f.state='Idle';activateEide(g.state,g.stage,f,i,characters.eide.moves.love);activateEide(g.state,g.stage,f,i,characters.eide.moves.seller);});assert.equal(g.state.clones.length,12);assert.equal(new Set(g.state.clones.map(c=>c.id)).size,12);for(let i=0;i<6;i++)assert.equal(g.state.clones.filter(c=>c.owner===i).length,2);});

test('entrance pauses for hit reactions, is not advanced twice, and replays from mid-walk',()=>{
 const g=game();activateEide(g.state,g.stage,g.state.fighters[0],0,characters.eide.moves.love);run(g,20);
 const f=g.state.clones[0].fighter,x=f.x;advanceEide(g.state);advanceEide(g.state);assert.equal(f.x,x);
 f.npcHitAt=g.state.frame;run(g,10);assert.equal(f.x,x);assert.equal(f.state,'HitStunStanding');
 const snap=g.snapshot();run(g,200);const expected=hashState(g.state);g.restore(snap);run(g,200);assert.equal(hashState(g.state),expected);
});
test('defeating a blonde during entrance stops her movement and preserves the other summon',()=>{
 const g=game();activateEide(g.state,g.stage,g.state.fighters[0],0,characters.eide.moves.love);run(g,25);
 const f=g.state.clones[0].fighter,x=f.x;f.health=0;run(g,15);assert.equal(f.x,x);assert.equal(f.state,'KO');assert.ok(inLove(g.state.fighters[0]));run(g,25);assert.equal(g.state.clones.length,1);
});

test('Love survives Eide losing lives and respawning until both companions die',()=>{
 const g=game(),f=g.state.fighters[0];activateEide(g.state,g.stage,f,0,characters.eide.moves.love);
 const ids=g.state.clones.map(c=>c.id);g.state.clones[0].fighter.health=125;
 f.health=0;g.step([0,0]);assert.equal(f.lives,2);assert.ok(inLove(f));
 run(g,120);assert.equal(f.respawnAt,0);assert.ok(inLove(f));
 assert.deepEqual(g.state.clones.map(c=>c.id),ids);assert.equal(g.state.clones[0].fighter.health,125);
 g.state.clones[0].fighter.health=0;g.step([0,0]);assert.ok(inLove(f));
 f.health=0;g.step([0,0]);assert.equal(f.lives,1);run(g,120);assert.ok(inLove(f));
 const hp=f.health;applyDamage(g.state,f,100);assert.equal(f.health,hp-80);
 g.state.clones.find(c=>c.fighter.health>0)!.fighter.health=0;g.step([0,0]);assert.equal(inLove(f),false);
});
test('both companions dying during respawn ends Love and rollback reproduces it',()=>{
 const g=game();activateEide(g.state,g.stage,g.state.fighters[0],0,characters.eide.moves.love);
 g.state.fighters[0].health=0;g.step([0,0]);const snapshot=g.snapshot();
 const finish=()=>{g.state.clones.forEach(c=>c.fighter.health=0);g.step([0,0]);assert.equal(inLove(g.state.fighters[0]),false);run(g,120);assert.equal(inLove(g.state.fighters[0]),false);return hashState(g.state);};
 const hash=finish();g.restore(snapshot);assert.equal(finish(),hash);
});
