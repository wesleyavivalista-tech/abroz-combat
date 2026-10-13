import test from 'node:test';
import assert from 'node:assert/strict';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {INVASION,INVASION_VARIANTS,INVADER_STATS,INVADER_MOVES,spawnInvader,advanceInvasionWaves,advanceInvaderAttack,advanceInvasionBullets} from '../packages/game-core/simulation/InvasionSystem.js';
import {advanceUndead,ZOMBIE_DEATH_FRAMES,ZOMBIE_CLAW} from '../packages/game-core/simulation/UndeadSystem.js';
import {clearCombatEntities,clearOwnedEntities} from '../packages/game-core/simulation/CombatLifecycle.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {stages} from '../packages/game-core/stages/registry.js';
import {Button} from '../packages/game-core/types.js';
import {RollbackManager} from '../packages/networking/RollbackManager.js';
import {VerifiedMatch} from '../apps/server/src/verifiedMatch.js';
import {encodeSnapshot,decodeSnapshot} from '../packages/shared/recovery.js';
import {invasionSpritePose} from '../apps/client/src/rendering/ZombieSpriteRenderer.js';
const game=(ids=['gut','drupa'])=>{const g=new GameSimulation(ids);g.state.phase='fight';g.state.phaseFrame=0;g.state.fighters.forEach(f=>{f.state='Idle';f.health=100000;});return g;};
const tick=(g:GameSimulation,n=1)=>{for(let i=0;i<n;i++)g.step(g.state.fighters.map(()=>0));};
const live=(g:GameSimulation,variant:typeof INVASION_VARIANTS[number])=>{const c=spawnInvader(g.state,g.stage,variant);c.fighter.undead='zombie';c.undead!.nextAttack=0;return c;};
test('3:00 spawns exactly two of each side; next wave at 3:10, including hitstop',()=>{
 const g=game();g.state.phaseFrame=INVASION.startFrames-2;tick(g);assert.equal(g.state.clones.length,0);g.state.hitstop=2;tick(g);
 assert.equal(g.state.clones.length,4);
 for(const c of g.state.clones){assert.equal(c.owner,-1);assert.equal(c.fighter.facing,c.invasion!.startsWith('pt-')?1:-1);assert.ok(c.invasion!.startsWith('pt-')?c.fighter.x<150:c.fighter.x>g.stage.width-150);}
 assert.equal(g.state.clones.filter(c=>c.invasion?.startsWith('pt-')).length,2);
 tick(g,599);assert.equal(g.state.clones.length,4);tick(g);assert.equal(g.state.clones.length,6);
});
test('intro, training and results never spawn invaders',()=>{
 for(const phase of ['intro','result'] as const){const g=game();g.state.phase=phase;g.state.phaseFrame=INVASION.startFrames;advanceInvasionWaves(g.state,g.stage);assert.equal(g.state.clones.length,0);}
 const g=game();g.state.training=true;g.state.phaseFrame=INVASION.startFrames;advanceInvasionWaves(g.state,g.stage);assert.equal(g.state.clones.length,0);
});
test('invasion cap is sixteen, balanced by side, independent of graves; no backlog',()=>{
 const g=game();const grave=spawnInvader(g.state,g.stage,'pt-normal');delete grave.invasion;grave.owner=0;grave.fighter.undead='grave';
 const seen=new Set<string>();for(let wave=0;wave<1000;wave++){g.state.phaseFrame=INVASION.startFrames+wave*INVASION.intervalFrames;g.state.frame=g.state.phaseFrame;advanceInvasionWaves(g.state,g.stage);g.state.clones.forEach(c=>{if(c.invasion)seen.add(c.invasion);});}
 assert.equal(g.state.clones.length,17);assert.ok(seen.size>=2);
 g.state.clones=g.state.clones.filter(c=>c===grave);g.state.phaseFrame+=INVASION.intervalFrames;advanceInvasionWaves(g.state,g.stage);assert.equal(g.state.clones.length,3);
});
test('all variants use exactly the original zombie movement on every stage',()=>{
 for(const stage of Object.values(stages))for(const variant of INVASION_VARIANTS){
  const a=game(),b=game();a.stage=b.stage=stage;const ca=live(a,variant),cb=live(b,variant);delete cb.invasion;
  for(const g of [a,b]){g.state.fighters[0].x=stage.width-100;g.state.fighters[1].x=stage.width-70;g.state.fighters.forEach(f=>f.y=stage.floorHeight);}
  for(const c of [ca,cb]){c.fighter.x=100;c.fighter.y=stage.floorHeight;c.fighter.facing=1;}
  for(let i=0;i<100;i++){a.state.frame++;b.state.frame++;advanceUndead(a.state,stage);advanceUndead(b.state,stage);assert.equal(ca.fighter.x,cb.fighter.x);assert.equal(ca.fighter.y,cb.fighter.y);}
 }
});
test('heavy zombie performs exactly three hits; interrupted combo cannot continue',()=>{
 const g=game(),c=live(g,'pt-heavy'),d=g.state.fighters[0];c.fighter.x=d.x-80;c.fighter.y=d.y=0;c.fighter.facing=1;c.undead!.attackAt=1;c.fighter.state='LightAttack';
 const damages:number[]=[],hitFrames:number[]=[];
 for(let i=0;i<59;i++){const hp=d.health;advanceInvaderAttack(g.state,g.stage,c);if(d.health<hp){damages.push(hp-d.health);hitFrames.push(i+1);}d.stun=0;d.state='Idle';d.combo=0;}
 assert.deepEqual(damages,[48,56,72]);assert.deepEqual(hitFrames,[14,31,48]);assert.equal(INVADER_STATS['pt-heavy'].cooldown,79);assert.equal(INVADER_STATS['pt-heavy'].end,59);assert.equal(c.fighter.state,'Idle');assert.equal(c.undead!.attackAt,0);
 c.undead!.attackAt=1;c.undead!.attackFrame=13;c.fighter.state='HitStunStanding';c.fighter.stun=10;const hp=d.health;advanceUndead(g.state,g.stage);assert.equal(c.undead!.attackAt,0);assert.equal(d.health,hp);
});
test('revolver windup is readable, bullets are slow and bounded, and dead shooters cannot retain shots',()=>{
 const g=game(),c=live(g,'br-revolver');c.fighter.x=300;c.fighter.facing=1;c.undead!.attackAt=1;
 for(let i=0;i<29;i++)advanceInvaderAttack(g.state,g.stage,c);assert.equal(g.state.invasion,undefined);
 advanceInvaderAttack(g.state,g.stage,c);const p=g.state.invasion!.bullets[0];assert.equal(p.vx,4);const x=p.x;advanceInvasionBullets(g.state,g.stage);assert.equal(p.x,x+4);
 c.fighter.health=0;advanceInvasionBullets(g.state,g.stage);assert.equal(g.state.invasion!.bullets.length,0);
});
test('bullets hit once, respect invulnerability, and opponents can jump over them',()=>{
 for(const mode of ['hit','immune','jump']){
  const g=game(),c=live(g,'br-revolver'),d=g.state.fighters[0];c.fighter.x=200;c.fighter.facing=1;d.x=350;d.y=mode==='jump'?300:0;if(mode==='immune')d.invulnerableUntil=1000;
  g.state.fighters[1].x=2200;g.state.invasion={nextBulletId:1,bullets:[{id:0,sourceId:c.id,x:300,y:100,vx:4,life:240}]};const hp=d.health;
  for(let i=0;i<40;i++)advanceInvasionBullets(g.state,g.stage);
  assert.equal(d.health,mode==='hit'?hp-68:hp);
 }
});
test('players and summons can hit neutral invaders, which do not inherit player ownership or vanish on departure',()=>{
 const g=game(['gut','drupa','bozo']),c=live(g,'pt-normal'),f=g.state.fighters[0];
 g.hit(0,characters.gut.moves.palm,0,false,-1,1,f,c.fighter);assert.ok(c.fighter.health<INVADER_STATS['pt-normal'].health);
 clearOwnedEntities(g.state,0);assert.ok(g.state.clones.includes(c));g.step([0,0,0],[0]);assert.ok(g.state.clones.includes(c));
});
test('invader death removes its actor after existing death animation and never creates a grave',()=>{
 const g=game(),c=live(g,'pt-normal');c.fighter.health=0;tick(g);assert.equal(c.fighter.undead,'dying');tick(g,ZOMBIE_DEATH_FRAMES);assert.equal(g.state.clones.length,0);assert.equal(g.state.finalDeaths,undefined);
});
test('winner and draw ignore invaders, and terminal cleanup clears bullets too',()=>{
 for(const draw of [false,true]){const g=game();live(g,'br-revolver');g.state.invasion={bullets:[],nextBulletId:3};g.state.fighters[0].lives=1;g.state.fighters[0].health=0;if(draw){g.state.fighters[1].lives=1;g.state.fighters[1].health=0;}tick(g);assert.equal(g.state.phase,'result');assert.equal(g.state.winner,draw?-1:1);assert.equal(g.state.clones.length,0);assert.equal(g.state.invasion,undefined);}
 const g=game();live(g,'pt-heavy');clearCombatEntities(g.state);assert.equal(g.state.clones.length,0);
});
test('snapshot recovery, authoritative simulation and late-input rollback agree across wave spawning',()=>{
 const a=game();a.state.phaseFrame=INVASION.startFrames-2;const initial=a.snapshot();const b=game();b.restore(decodeSnapshot(encodeSnapshot(initial)));
 const server=new VerifiedMatch(game(),()=>{});server.simulation.restore(initial);const rb=new RollbackManager(b,0,0,8);rb.confirmed=b.state.frame-1;
 for(let n=0;n<750;n++){const frame=a.state.frame,remote=n%80<40?Button.Left:Button.Right;a.step([0,remote]);server.receive(0,frame,0);server.receive(1,frame,remote);rb.local.set(frame,0);assert.ok(rb.tick());rb.receive(frame,remote,1);}
 assert.ok(rb.rollbackCount>0);assert.equal(hashState(a.state),hashState(b.state));assert.equal(hashState(a.state),hashState(server.simulation.state));
 const restored=game();restored.restore(decodeSnapshot(encodeSnapshot(a.snapshot())));tick(a,80);tick(restored,80);assert.equal(hashState(a.state),hashState(restored.state));
});
test('every invasion animation index is valid, including the three weapon contacts and airborne poses',()=>{
 const g=game();for(const variant of INVASION_VARIANTS){const c=live(g,variant),f=c.fighter,u=c.undead!;for(const state of ['Idle','WalkForward','LightAttack','Jump','Fall','HitStunStanding'] as const){f.state=state;for(let frame=0;frame<160;frame++){u.attackFrame=frame;const pose=invasionSpritePose(f,u,variant,frame,frame);assert.ok(pose>=0&&pose<16);}}
 if(variant==='pt-heavy'){f.state='LightAttack';for(const [age,pose] of [[14,6],[31,9],[48,11]]){u.attackFrame=age;assert.equal(invasionSpritePose(f,u,variant,age,0),pose);}}
 }
});


test('seeded wave selection can produce all three types on each side and replays exactly',()=>{
 const a=game(),b=game(),seen=new Set<string>();
 for(let wave=0;wave<100;wave++){
  for(const g of [a,b]){g.state.phaseFrame=INVASION.startFrames+wave*INVASION.intervalFrames;g.state.frame=g.state.phaseFrame;advanceInvasionWaves(g.state,g.stage);}
  assert.equal(hashState(a.state),hashState(b.state));a.state.clones.forEach(c=>seen.add(c.invasion!));a.state.clones=[];b.state.clones=[];
 }
 assert.deepEqual([...seen].sort(),[...INVASION_VARIANTS].sort());
});

test('neutral invaders safely receive every fighter attack and affect summons without owning a player slot',()=>{
 for(const id of Object.keys(characters)){
  const g=game([id,'gut']),c=live(g,'pt-heavy'),source=g.state.fighters[0];
  for(const move of Object.values(characters[id].moves)){
   if(!move.damage&&!move.trapFrames)continue;
   Object.assign(c.fighter,{health:10000,lives:1,undead:'zombie',stun:0,state:'Idle',grappleUntil:0,trappedUntil:0,invulnerableUntil:0});source.stampAttempts=3;
   g.hit(0,move,0,false,-1,1,source,c.fighter);assert.ok(Number.isFinite(c.fighter.health),`${id}/${move.id}`);
  }
 }
});
test('new tournament rounds reset the invasion countdown and clear old entities',()=>{
 const g=new GameSimulation(['gut','drupa'],false,undefined,undefined,undefined,true);g.state.phase='fight';g.state.phaseFrame=INVASION.startFrames-1;tick(g);assert.equal(g.state.clones.length,4);
 g.state.fighters[0].lives=1;g.state.fighters[0].health=0;tick(g);assert.equal(g.state.invasion,undefined);tick(g,481);assert.equal(g.state.clones.length,0);assert.equal(g.state.phase,'intro');
});
test('solid walls stop invasion bullets before a fighter behind them',()=>{
 const g=game(),c=live(g,'br-revolver'),d=g.state.fighters[0];c.fighter.x=200;c.fighter.facing=1;d.x=700;g.state.fighters[1].x=2200;
 g.state.structures=[{id:0,owner:0,kind:'wall',move:'wall',phase:'built',x:500,y:0,width:80,height:300,health:300,maxHealth:300,createdAt:0,expiresAt:1000,hits:{},trapped:[],nextShot:0,shots:0,facing:1}];
 g.state.invasion={nextBulletId:1,bullets:[{id:0,sourceId:c.id,x:300,y:100,vx:4,life:240}]};const hp=d.health;
 for(let i=0;i<120;i++)advanceInvasionBullets(g.state,g.stage);assert.equal(d.health,hp);assert.equal(g.state.invasion.bullets.length,0);
});

test('invasion damage doubles without changing player-zombie claw or poison',()=>{
 assert.deepEqual(Object.values(INVADER_MOVES).map(m=>m.damage),[56,76,48,56,72,68]);
 assert.equal(ZOMBIE_CLAW.damage,48);assert.equal(ZOMBIE_CLAW.poisonDamage,10);
});

test('all invasion attack cycles gain another thirty percent speed; movement and bullet speed are untouched',()=>{
 assert.deepEqual(Object.values(INVADER_STATS).map(v=>v.cooldown),[64,77,79,64,77,106]);
 assert.deepEqual(Object.values(INVADER_STATS).map(v=>v.end),[34,43,59,34,43,55]);
 assert.equal(INVASION.bulletSpeed,4);assert.equal(ZOMBIE_CLAW.startupFrames,18);
});

test('heavy opening dashes from medium range in either direction, then completes the three-hit combo',()=>{
 for(const direction of [-1,1]){
  const g=game(),c=live(g,'pt-heavy'),d=g.state.fighters[0];
  c.fighter.x=1000;c.fighter.y=d.y=0;d.x=1000+direction*320;g.state.fighters[1].x=2300;g.state.frame=10;
  advanceUndead(g.state,g.stage);assert.equal(c.undead!.attackAt,10);assert.equal(c.fighter.facing,direction);
  const damages:number[]=[];
  for(let age=1;age<=INVADER_STATS['pt-heavy'].end;age++){
   g.state.frame++;const hp=d.health;advanceUndead(g.state,g.stage);
   if(d.health<hp)damages.push(hp-d.health);
   if(age<5)assert.equal(c.fighter.x,1000,'readable windup before lunging');
   if(age>=14)assert.equal(c.fighter.x,1000+direction*240,'only the first strike lunges');
   d.stun=0;d.state='Idle';d.combo=0;
  }
  assert.deepEqual(damages,[48,56,72]);
 }
});

test('heavy dash stops before nearby targets, built walls and arena edges',()=>{
 for(const mode of ['near','wall','edge']){
  const g=game(),c=live(g,'pt-heavy'),d=g.state.fighters[0];
  c.fighter.x=mode==='edge'?g.stage.width-100:500;c.fighter.y=d.y=0;c.fighter.facing=1;
  d.x=mode==='edge'?g.stage.width+100:mode==='near'?600:820;
  c.undead!.target=0;c.undead!.attackAt=1;
  if(mode==='wall')g.state.structures=[{id:0,owner:0,kind:'wall',move:'wall',phase:'built',x:650,y:0,width:80,height:300,health:300,maxHealth:300,createdAt:0,expiresAt:1000,hits:{},trapped:[],nextShot:0,shots:0,facing:1}];
  for(let i=0;i<14;i++)advanceInvaderAttack(g.state,g.stage,c);
  if(mode==='near')assert.equal(c.fighter.x,520);
  if(mode==='wall')assert.ok(c.fighter.x<=579&&c.fighter.x>500);
  if(mode==='edge')assert.equal(c.fighter.x,g.stage.width-40);
 }
});

test('heavy dash stops on interruption and replays identically from a mid-dash snapshot',()=>{
 const g=game(),c=live(g,'pt-heavy'),d=g.state.fighters[0];
 c.fighter.x=500;c.fighter.y=d.y=0;d.x=820;g.state.fighters[1].x=2200;
 tick(g,9);assert.ok(c.fighter.x>500);assert.ok(c.undead!.attackAt);
 const saved=g.snapshot();tick(g,70);const expected=hashState(g.state);
 g.restore(saved);tick(g,70);assert.equal(hashState(g.state),expected);
 g.restore(saved);const interrupted=g.state.clones[0],x=interrupted.fighter.x;
 interrupted.fighter.state='HitStunStanding';interrupted.fighter.stun=20;interrupted.fighter.vx=0;
 tick(g,6);assert.equal(interrupted.undead!.attackAt,0);assert.equal(interrupted.fighter.x,x);
});

test('revolver engages fifty percent farther away and bullets reach beyond their former lifetime',()=>{
 const g=game(),c=live(g,'br-revolver'),d=g.state.fighters[0];
 c.fighter.x=100;c.fighter.y=d.y=0;d.x=1000;g.state.fighters[1].x=2200;g.state.frame=10;
 advanceUndead(g.state,g.stage);assert.equal(c.undead!.attackAt,10);
 assert.equal(INVADER_STATS['br-revolver'].range,650*1.5);
 for(let i=0;i<30;i++)advanceInvaderAttack(g.state,g.stage,c);
 const bullet=g.state.invasion!.bullets[0];assert.equal(bullet.life,240*1.5);assert.equal(bullet.vx,4);
 d.x=1300;const hp=d.health;
 for(let i=0;i<300;i++)advanceInvasionBullets(g.state,g.stage);
 assert.equal(d.health,hp-68);assert.equal(g.state.invasion!.bullets.length,0);
});
