import test from 'node:test';
import assert from 'node:assert/strict';
import {GameSimulation} from '../packages/game-core/simulation/GameSimulation.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {basicAttacks} from '../packages/game-core/characters/common.js';
import {hitboxes,worldBox} from '../packages/game-core/combat/CollisionSystem.js';
import {BASIC_MELEE,basicMeleeTier,advanceBasicMelee} from '../packages/game-core/combat/BasicMelee.js';
import {Button} from '../packages/game-core/types.js';
function game(distance=150){const g=new GameSimulation(['caio','gut']);g.state.phase='fight';const [f,d]=g.state.fighters;f.state=d.state='Idle';f.x=500;d.x=500+distance;return g;}
test('roster basics gain bounded forward reach; specials and projectile basics are untouched',()=>{
 for(const id of Object.keys(characters)){
  const g=new GameSimulation([id,'gut']);const f=g.state.fighters[0];
  for(const weapon of [0,1000]){f.weaponUntil=weapon;
   for(const m of Object.values(characters[id].moves)){
    f.moveFrame=m.startupFrames;const before=m.hitboxes.map(b=>worldBox(f,b)),after=hitboxes(f,m),tier=basicMeleeTier(f,m);
    if(tier===null){assert.deepEqual(after,before);continue;}
    for(let i=0;i<after.length;i++){
     assert.ok(after[i].x>=f.x);const oldEnd=m.hitboxes[i].x+m.hitboxes[i].w;
     assert.ok(after[i].x+after[i].w-f.x<=oldEnd*1.25+.001);
    }
   }
  }
 }
});
test('extra reach connects visually near misses once, but excludes distant and rear opponents',()=>{
 for(const distance of [150,230,-90]){
  const g=game(distance),d=g.state.fighters[1],health=d.health;
  for(let i=0;i<28;i++)g.step([i===0?Button.Light:0,0]);
  assert.equal(health-d.health,distance===150?characters.caio.moves.light.damage:0);
 }
});
test('startup step is gradual, mirrored, modest, and capped by fighter bodies and arena walls',()=>{
 for(const facing of [1,-1] as const){
  const g=game(),[f,d]=g.state.fighters;f.facing=facing;d.x=f.x+facing*300;
  const m=characters.caio.moves.light,start=f.x;
  for(let frame=0;frame<m.startupFrames;frame++){const prev=f.x;f.moveFrame=frame;advanceBasicMelee(g.state,f,m,frame-1,g.stage);assert.ok(Math.abs(f.x-prev)<=3);}
  assert.ok(Math.abs((f.x-start)*facing-BASIC_MELEE.lungeDistance[0])<.001);
  d.x=f.x+facing*66;f.moveFrame=0;advanceBasicMelee(g.state,f,m,-1,g.stage);assert.ok((d.x-f.x)*facing>=65);
  f.x=facing===1?g.stage.width-40:40;d.x=500;advanceBasicMelee(g.state,f,m,-1,g.stage);assert.ok(f.x>=40&&f.x<=g.stage.width-40);
 }
});
test('assistance is small and only for nearby opponents ahead at a similar height',()=>{
 function distance(dx:number,dy=0){const g=game(dx),[f,d]=g.state.fighters;d.y+=dy;const m=characters.caio.moves.light;for(let i=0;i<m.startupFrames;i++){f.moveFrame=i;advanceBasicMelee(g.state,f,m,i-1,g.stage);}assert.equal(f.facing,1);assert.equal(f.y,g.stage.floorHeight);return f.x-500;}
 assert.ok(Math.abs(distance(100)-12)<.001);
 for(const [dx,dy] of [[-100,0],[300,0],[100,80]])assert.ok(Math.abs(distance(dx,dy)-8)<.001);
});
test('melee movement and hits replay identically from a multiplayer snapshot',()=>{
 const g=game(150);g.step([Button.Light,0]);g.step([0,0]);const copy=game();copy.restore(g.snapshot());
 for(let i=0;i<35;i++){g.step([0,0]);copy.step([0,0]);assert.deepEqual(copy.snapshot(),g.snapshot());}
});
test('later combo attacks step farther without changing authored move properties',()=>{
 const g=game(500),f=g.state.fighters[0];const basics=basicAttacks(characters.caio,f);
 const distances=basics.chain.map(id=>{const m=characters.caio.moves[id],start=f.x;for(let i=0;i<m.startupFrames;i++){f.moveFrame=i;advanceBasicMelee(g.state,f,m,i-1,g.stage);}return f.x-start;});
 assert.ok(distances[0]<distances[1]&&distances[1]<distances[2]);
});
test('hitstop pauses the step and speed boosts do not multiply its distance',()=>{
 for(const boosted of [false,true]){
  const g=game(600),f=g.state.fighters[0];if(boosted)f.onFireUntil=1000;
  g.step([Button.Light,0]);const paused=f.x;g.state.hitstop=3;for(let i=0;i<3;i++)g.step([0,0]);assert.equal(f.x,paused);
  for(let i=0;i<10;i++)g.step([0,0]);assert.ok(Math.abs(f.x-508)<.3);
 }
});
test('assistance ignores allies and vertical padding stays small',()=>{
 const g=new GameSimulation(['caio','gut','caio','gut'],false,undefined,[0,1,0,1]);g.state.phase='fight';const [f,enemy,ally,other]=g.state.fighters;f.x=500;ally.x=600;enemy.x=1000;other.x=1500;
 const m=characters.caio.moves.light;for(let i=0;i<m.startupFrames;i++){f.moveFrame=i;advanceBasicMelee(g.state,f,m,i-1,g.stage);}assert.ok(Math.abs(f.x-508)<.001);
 f.moveFrame=m.startupFrames;const box=hitboxes(f,m)[0];assert.equal(box.h,m.hitboxes[0].h+8);assert.equal(box.y,f.y+m.hitboxes[0].y-4);
});
