import test from 'node:test';
import assert from 'node:assert/strict';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {stages} from '../packages/game-core/stages/registry.js';
import {Button} from '../packages/game-core/types.js';
import {RollbackManager} from '../packages/networking/RollbackManager.js';

const roster=Object.keys(characters);
const buttons=[Button.Light,Button.Medium,Button.Heavy,Button.Special,Button.Special2,Button.Super1,Button.Super2];
function random(seed:number){return ()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return seed>>>0;};}
function check(g:GameSimulation,label:string){
 const s=g.state;
 assert.equal(new Set(s.clones.map(c=>c.id)).size,s.clones.length,label+': duplicate clones');
 assert.equal(new Set((s.structures??[]).map(c=>c.id)).size,s.structures?.length??0,label+': duplicate structures');
 for(const f of [...s.fighters,...s.clones.map(c=>c.fighter)]){
  assert.ok([f.x,f.y,f.vx,f.vy,f.health,f.meter,f.stun].every(Number.isFinite),label+': non-finite actor');
  assert.ok(f.stun>=0,label+': negative stun');
  assert.ok(f.move===null||characters[f.characterId].moves[f.move],label+': invalid move');
 }
 for(const [seat,f] of s.fighters.entries())if(f.lives===0||f.respawnAt){
  assert.equal(f.move,null,label+': dead attacking');assert.equal(f.weaponUntil,0,label+': dead transformed');
  assert.ok(!s.projectiles.some(p=>p.active&&p.owner===seat),label+': orphan projectile');
  assert.ok(!s.clones.some(c=>c.owner===seat&&!c.undead),label+': orphan summon');
 }
 if(s.phase==='result'){
  assert.ok(s.projectiles.every(p=>!p.active),label+': result projectile');
  assert.equal(s.clones.length,0,label+': result clone');assert.equal(s.hazards.length,0,label+': result hazard');
 }
}
for(const stage of Object.values(stages))for(const half of [0,1])test(`chaos ${stage.id}/roster ${half+1}: spam, simultaneous KOs, forfeits, reset and replay`,()=>{
 const ids=roster.slice(half*8,half*8+8),rng=random(0xc0ffee+half);
 const g=new GameSimulation(ids,false,stage);g.state.phase='fight';
 g.state.fighters.forEach(f=>{f.state='Idle';f.meter=100;});
 let snapshot=g.snapshot();let sequence:{inputs:number[];forfeits:number[];ko:number[]}[]=[];
 for(let tick=0;tick<2400;tick++){
  const inputs=ids.map((_,seat)=>{
   const r=rng();const direction=tick%120<60?(seat%2?Button.Left:Button.Right):0;
   return tick%7===0?2047:tick%3===0?0:direction|(r%9===0?Button.Up:0)|buttons[r%buttons.length];
  });
  // Controlled lethal damage at a known tick exercises life resolution alongside
  // real authored abilities. It is not presented as player-input-only coverage.
  const ko=tick%600===270?[0,1]:tick%600===520?[2,3,4,5,6,7]:[];
  const forfeits=tick%600===271?[0,7]:[];
  ko.forEach(seat=>{g.state.fighters[seat].health=0;});
  g.step(inputs,forfeits);sequence.push({inputs,forfeits,ko});check(g,`${stage.id}/${half}/${tick}`);
  if(tick%600===599){
   const expected=hashState(g.state);g.restore(snapshot);
   for(const frame of sequence){frame.ko.forEach(seat=>{g.state.fighters[seat].health=0;});g.step(frame.inputs,frame.forfeits);}
   assert.equal(hashState(g.state),expected,'replay diverged');
   g.resetPositions();g.state.phase='fight';g.state.fighters.forEach(f=>{f.meter=100;});
   check(g,'reset');assert.equal(g.state.clones.length,0);assert.equal(g.state.hazards.length,0);
   snapshot=g.snapshot();sequence=[];
  }
 }
});

test('chaos: eight-player delayed inputs plus duplicate departure and attack packets converge',()=>{
 const ids=['jopa','bozo','napa','eide','fausto','caio','roms','dodo'];
 const make=()=>{const g=new GameSimulation(ids,false,stages['shopping-mall']);g.state.phase='fight';g.state.fighters.forEach(f=>{f.state='Idle';f.meter=100;});return g;};
 const baseline=make(),live=make(),peer=new RollbackManager(live,0,0);
 const input=(frame:number,seat:number)=>frame%83===0?Button.Super1:frame%83===40?Button.Super2:frame%9===0?buttons[(frame+seat)%buttons.length]:frame%11<5?(seat%2?Button.Left:Button.Right):0;
 const queue:{due:number;frame:number;seat:number;mask:number}[]=[];
 let clock=0,stalls=0;
 while(live.state.frame<900&&clock<4000){
  const frame=live.state.frame;
  if(!peer.local.has(frame)){
   peer.schedule(input(frame,0),()=>{});
   for(let seat=1;seat<8;seat++)queue.push({due:clock+seat+(frame%17===0?18:0),frame,seat,mask:input(frame,seat)});
  }
  for(let i=queue.length-1;i>=0;i--)if(queue[i].due<=clock){const p=queue.splice(i,1)[0];peer.receive(p.frame,p.mask,p.seat);peer.receive(p.frame,p.mask,p.seat);}
  if(frame>=350&&!peer.departures.has(2)){peer.disconnect(2,346);peer.disconnect(3,346);peer.disconnect(2,346);}
  if(!peer.tick())stalls++;
  assert.equal(peer.desync,'OK');clock++;
 }
 for(const p of queue)peer.receive(p.frame,p.mask,p.seat);
 for(let frame=0;frame<900;frame++)baseline.step(ids.map((_,seat)=>seat>=2&&seat<=3&&frame>=346?0:input(frame,seat)),frame===346?[2,3]:[]);
 assert.equal(live.state.frame,900);assert.ok(stalls>0);assert.ok(peer.rollbackCount>0);
 assert.equal(peer.desync,'OK');assert.equal(hashState(live.state),hashState(baseline.state));check(live,'network final');
 assert.ok(peer.local.size<=182);assert.ok(peer.remotes.every(m=>m.size<=182));
});

for(const id of ['bozo','napa','jopa','dodo'])test(`chaos ${id}: eight simultaneous summons, damage, departures and repeated rematches`,t=>{
 let peakClones=0,peakProjectiles=0,peakBytes=0;
 const g=new GameSimulation(Array(8).fill(id),false,stages['shopping-mall']);
 for(let match=0;match<12;match++){
  g.resetPositions();g.state.phase='fight';g.state.phaseFrame=0;
  g.state.fighters.forEach(f=>{f.meter=100;});
  for(let tick=0;tick<480;tick++){
   const inputs=g.state.fighters.map((_,seat)=>tick<240?(tick===0?(id==='bozo'?Button.Super2:Button.Super1):0):tick%4===0?buttons[(tick+seat)%buttons.length]:0);
   if(tick===320){g.state.fighters[0].health=0;g.state.fighters[1].health=0;}
   g.step(inputs,tick===320?[2,3]:tick===450?[4,5,6,7]:[]);
   check(g,`${id}/${match}/${tick}`);
   peakClones=Math.max(peakClones,g.state.clones.length);
   peakProjectiles=Math.max(peakProjectiles,g.state.projectiles.filter(p=>p.active).length);
   if(tick%120===0)peakBytes=Math.max(peakBytes,JSON.stringify(g.snapshot()).length);
  }
 }
 assert.ok(peakClones>=8,`${id}: summon stress did not activate`);
 g.resetPositions();assert.equal(g.state.clones.length,0);assert.equal(g.state.hazards.length,0);
 assert.equal(g.state.projectiles.filter(p=>p.active).length,0);
 t.diagnostic(JSON.stringify({peakClones,peakProjectiles,peakSnapshotCharacters:peakBytes,rematches:12}));
});
