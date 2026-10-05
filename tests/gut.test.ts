import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {Button} from '../packages/game-core/types.js';
import {RollbackManager} from '../packages/networking/RollbackManager.js';
const m=characters.gut.moves;
function match(n=2){const s=new GameSimulation(Array(n).fill('gut'));s.state.phase='fight';s.state.fighters.forEach(f=>f.state='Idle');return s;}
function run(s:GameSimulation,n:number,mask=0){for(let i=0;i<n;i++)s.step([mask,0,0,0,0,0]);}
test('Gut has two skins and a three-press kung fu chain; heavy and wide swing are standalone',()=>{
 assert.equal(characters.gut.skins?.length,2);const s=match(),f=s.state.fighters[0];s.step([Button.Light,0]);assert.equal(f.move,'palm');run(s,3);s.step([Button.Light,0]);run(s,10);assert.equal(f.move,'cross');s.step([Button.Light,0]);run(s,14);assert.equal(f.move,'finish');run(s,70);s.step([Button.Medium,0]);assert.equal(f.move,'axe');run(s,80);s.step([Button.Heavy,0]);assert.equal(f.move,'swing');
});
test('Gut bear hug traps both participants for four seconds and releases; interruption frees victim',()=>{
 const s=match(),[a,b]=s.state.fighters;a.x=800;b.x=880;a.move='hug';s.hit(0,m.hug,0,false,1);const expiry=b.grappleUntil,hp=b.health;
 assert.equal(expiry-s.state.frame,240);assert.equal(a.state,'Grappling');assert.equal(b.state,'Grappled');run(s,239,Button.Right|Button.Light);assert.equal(a.x,800);assert.equal(b.x,842);assert.ok(b.health<hp);assert.equal(b.move,null);run(s,2);assert.equal(b.grappleUntil,0);assert.notEqual(a.state,'Grappling');
 const t=match(3),[holder,victim]=t.state.fighters;holder.move='hug';t.hit(0,m.hug,0,false,1);t.hit(2,m.swing,0,false,0);run(t,1);assert.equal(victim.grappleUntil,0);
});
test('grapple cannot take multiple targets or bypass guard, teams or spawn immunity',()=>{
 const s=match(3);s.state.fighters[0].move='hug';s.hit(0,m.hug,0,false,1);s.hit(0,m.hug,0,false,2);assert.equal(s.state.fighters[2].grappleUntil,0);
 for(const mode of ['guard','immune','ally']){const t=new GameSimulation(['gut','gut','gut','gut'],false,undefined,[0,1,0,1]);t.state.phase='fight';t.state.fighters.forEach(f=>f.state='Idle');const index=mode==='ally'?2:1,d=t.state.fighters[index];d.facing=-1;if(mode==='immune')d.invulnerableUntil=100;t.hit(0,m.hug,mode==='guard'?Button.Right:0,false,index);assert.equal(d.grappleUntil,0);}
});
test('Immortal adds exactly one life without healing and cannot be recast after respawn',()=>{
 const s=match(),f=s.state.fighters[0];f.meter=100;f.health=700;s.step([Button.Super1,0]);run(s,45);assert.equal(f.lives,4);assert.equal(f.health,700);run(s,80);f.meter=100;s.step([Button.Super1,0]);assert.equal(f.move,null);f.health=0;run(s,1);assert.equal(f.lives,3);run(s,120);assert.deepEqual(f.usedSupers,['immortal']);
});
test('spear lasts 20 seconds, changes all basics, expires midmove and clears on knockout',()=>{
 const s=match(),f=s.state.fighters[0];f.meter=100;s.step([Button.Super2,0]);run(s,24);assert.equal(f.weaponUntil-s.state.frame,1800);run(s,30);s.step([Button.Light,0]);assert.equal(f.move,'thrust');run(s,60);s.step([Button.Medium,0]);assert.equal(f.move,'spearHeavy');run(s,70);s.step([Button.Heavy,0]);assert.equal(f.move,'spearSwing');f.weaponUntil=s.state.frame+1;run(s,1);assert.equal(f.weaponUntil,0);assert.equal(f.move,'spearThrow');run(s,60);s.step([Button.Light,0]);assert.equal(f.move,'palm');f.weaponUntil=9999;f.health=0;run(s,1);assert.equal(f.weaponUntil,0);
});
test('meditation heals only each two seconds held, caps health and stops on release',()=>{
 const s=match(),f=s.state.fighters[0];f.health=600;f.meter=100;const x=f.x;
 run(s,119,Button.Special2|Button.Right);assert.equal(f.health,600);assert.equal(f.x,x);assert.equal(f.move,'meditation');
 run(s,1,Button.Special2);assert.equal(f.health,685);run(s,120,Button.Special2);assert.equal(f.health,770);
 run(s,1);assert.equal(f.move,null);run(s,200);assert.equal(f.health,770);
 run(s,119,Button.Special2);assert.equal(f.health,770);run(s,1,Button.Special2);assert.equal(f.health,855);
 run(s,1800,Button.Special2);assert.equal(f.health,1500);
});
test('meditation is interrupted by hits and cannot start airborne or resume just by holding',()=>{
 const s=match(),f=s.state.fighters[0];f.health=500;run(s,170,Button.Special2);
 s.hit(1,m.palm,0,false,0);const hp=f.health;run(s,200,Button.Special2);assert.equal(f.health,hp);assert.notEqual(f.move,'meditation');
 run(s,1);f.y=100;f.state='Fall';s.step([Button.Special2,0]);assert.notEqual(f.move,'meditation');
});
test('extended bear hug reaches a slightly farther opponent',()=>{
 const s=match(),[a,b]=s.state.fighters;a.x=300;b.x=585;s.step([Button.Special,0]);run(s,40);assert.equal(a.state,'Grappling');assert.equal(b.state,'Grappled');
});
test('Gut supers require a full bar and online grapple/weapon/life state replays identically',()=>{
 for(const key of [Button.Super1,Button.Super2]){const s=match();s.state.fighters[0].meter=99;s.step([key,0]);assert.equal(s.state.fighters[0].move,null);}
 for(const n of [4,6]){const a=match(n),b=match(n);for(const s of [a,b])s.state.fighters.forEach((f,i)=>{f.x=350+i*100;f.meter=100;});const rb=new RollbackManager(b,0,0,8);
 for(let frame=0;frame<400;frame++){const masks=Array.from({length:n},(_,i)=>frame===0?(i%2?Button.Super1:Button.Super2):frame===90?Button.Special:frame>=150&&frame<390?Button.Special2:0);a.step(masks);rb.local.set(frame,masks[0]);rb.tick();for(let i=1;i<n;i++)rb.receive(frame,masks[i],i);}assert.equal(hashState(a.state),hashState(b.state));}
});

test('a defeated or removed summoned target cannot leave Gut stuck holding it',()=>{
 const s=new GameSimulation(['gut','bozo']);s.state.phase='fight';s.state.fighters.forEach(f=>f.state='Idle');
 const clone=structuredClone(s.state.fighters[1]);clone.health=100;clone.lives=1;s.state.clones.push({id:0,owner:1,fighter:clone});
 s.state.fighters[0].move='hug';s.hit(0,m.hug,0,false,1,1,s.state.fighters[0],clone);assert.equal(s.state.fighters[0].state,'Grappling');clone.health=0;run(s,1);assert.notEqual(s.state.fighters[0].state,'Grappling');
});

test('Rising spear catches an opponent above Gut and launches upward',()=>{
 const s=match(),[a,b]=s.state.fighters;a.x=500;a.weaponUntil=1000;a.move='spearHeavy';a.moveFrame=m.spearHeavy.startupFrames-1;
 b.x=710;b.y=280;b.vy=0;b.state='Fall';s.step([0,0]);assert.ok(b.health<1500);assert.ok(b.vy>0);
 const t=match(),[c,d]=t.state.fighters;c.x=500;c.weaponUntil=1000;c.move='spearHeavy';c.moveFrame=m.spearHeavy.startupFrames-1;d.x=710;d.y=0;t.step([0,0]);assert.equal(d.health,1500);
});

test('double-jump heavy becomes a spear dive only with the weapon active',()=>{
 for(const weapon of [false,true])for(const double of [false,true]){
  const s=match(),f=s.state.fighters[0];f.y=350;f.state='Jump';f.airJumpUsed=double;f.weaponUntil=weapon?1000:0;
  s.step([Button.Medium,0]);assert.equal(f.move,weapon&&double?'spearDive':weapon?'spearAir':'air');
 }
 const s=match(),f=s.state.fighters[0];f.weaponUntil=1000;
 s.step([Button.Up,0]);run(s,8);s.step([Button.Up,0]);assert.equal(f.airJumpUsed,true);
 run(s,1);s.step([Button.Medium,0]);assert.equal(f.move,'spearDive');run(s,8);assert.ok(f.vy<0);
 run(s,65);assert.equal(f.y,0);assert.equal(f.move,null);assert.equal(f.airJumpUsed,false);
});
test('spear dive hits on descent once and can be interrupted or expire with the weapon',()=>{
 const s=match(),[a,b]=s.state.fighters;a.x=600;b.x=725;a.y=230;a.state='Fall';a.airJumpUsed=true;a.weaponUntil=1000;
 s.step([Button.Medium,0]);run(s,18);assert.ok(b.health<1500);const hp=b.health;run(s,65);assert.equal(b.health,hp);
 const t=match(),f=t.state.fighters[0];f.y=400;f.state='Fall';f.airJumpUsed=true;f.weaponUntil=1000;t.step([Button.Medium,0]);t.hit(1,m.palm,0,false,0);assert.equal(f.move,null);
 const u=match(),g=u.state.fighters[0];g.y=400;g.state='Fall';g.airJumpUsed=true;g.weaponUntil=10;u.step([Button.Medium,0]);run(u,10);assert.equal(g.weaponUntil,0);assert.equal(g.move,'spearThrow');
});

test('expired spear crosses the arena in either direction, hits only the first opponent and throws once',()=>{
 for(const facing of [1,-1] as const){
  const s=match(3),[a,b,c]=s.state.fighters;
  a.x=facing===1?100:2300;a.facing=facing;a.weaponUntil=1;
  b.x=facing===1?2050:350;c.x=facing===1?2270:130;
  const hp=b.health,other=c.health;s.step([0,0,0]);
  const shot=s.state.projectiles.find(p=>p.active&&p.move==='spearThrow');assert.ok(shot);assert.equal(Math.sign(shot.vx),facing);
  run(s,130);assert.equal(b.health,hp-m.spearThrow.damage);assert.equal(c.health,other);assert.equal(s.state.projectiles.filter(p=>p.active&&p.move==='spearThrow').length,0);
  run(s,180);assert.equal(b.health,hp-m.spearThrow.damage);
 }
});
test('expiry throw ignores teammates, respects guard, and never spawns from a dead fighter',()=>{
 const s=new GameSimulation(['gut','gut','gut','gut'],false,undefined,[0,1,0,1]);s.state.phase='fight';s.state.fighters.forEach(f=>{f.state='Idle';f.y=0});
 const [a,b,ally,c]=s.state.fighters;a.x=100;a.facing=1;a.weaponUntil=1;ally.x=400;b.x=900;c.x=1700;run(s,60);assert.equal(ally.health,1500);assert.ok(b.health<1500);assert.equal(c.health,1500);
 const dead=match();dead.state.fighters[0].weaponUntil=1;dead.state.fighters[0].health=0;run(dead,1);assert.equal(dead.state.projectiles.some(p=>p.active),false);
 const guard=match(),[g,d]=guard.state.fighters;g.x=100;g.weaponUntil=1;d.x=350;d.facing=-1;for(let i=0;i<30;i++)guard.step([0,Button.Right]);assert.equal(d.health,1500-Math.ceil(m.spearThrow.damage*.4));assert.equal(guard.state.projectiles.some(p=>p.active),false);
});
test('spear expiry and its projectile replay identically after snapshot restoration',()=>{
 const s=match();s.state.fighters[0].weaponUntil=8;s.state.fighters[0].x=100;s.state.fighters[1].x=1800;
 const snapshot=structuredClone(s.state);run(s,125);const expected=hashState(s.state);
 s.state=structuredClone(snapshot);run(s,125);assert.equal(hashState(s.state),expected);
});

test('rising spear reaches an opponent standing on either platform using a real hop',()=>{
 for(const facing of [1,-1] as const){
  const s=match(),[a,b]=s.state.fighters;
  a.x=facing===1?500:1900;a.facing=facing;a.weaponUntil=1000;a.move='spearHeavy';a.moveFrame=m.spearHeavy.startupFrames-1;
  b.x=a.x+210*facing;b.y=340;b.vy=0;b.state='Idle';const hp=b.health;
  let hit=false;for(let i=0;i<7;i++){s.step([0,0]);if(b.health<hp){hit=true;break;}}
  assert.ok(hit,'standing platform opponent should be in spear reach');assert.ok(a.y>0&&a.y<110,'reach comes from an actual hop');assert.ok(b.vy>0);
 }
});
test('rising spear cannot hit an opponent beyond the extended melee reach',()=>{
 const s=match(),[a,b]=s.state.fighters;a.x=500;a.facing=1;a.weaponUntil=1000;a.move='spearHeavy';a.moveFrame=m.spearHeavy.startupFrames-1;b.x=900;b.y=340;b.state='Idle';const hp=b.health;
 run(s,7);assert.equal(b.health,hp);
});

test('bear hug reaches twice as far in either direction but misses beyond its new reach',()=>{
 for(const facing of [1,-1] as const)for(const distance of [570,700]){
  const s=match(),[a,b]=s.state.fighters;a.x=1000;a.facing=facing;b.x=a.x+distance*facing;b.facing=-facing as 1|-1;
  s.step([Button.Special,0]);run(s,40);
  assert.equal(b.state==='Grappled',distance===570);
 }
});
