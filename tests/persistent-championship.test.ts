import {GameSimulation} from '../packages/game-core/simulation/GameSimulation.js';
import {resultScreen} from '../apps/client/src/ui/ResultScreen.js';
import {matchStatisticsScreen} from '../apps/client/src/ui/MatchStatistics.js';
import {decodeSnapshot} from '../packages/shared/recovery.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {WebSocket} from 'ws';
import {ChampionshipStore} from '../apps/server/src/persistent/store.js';
import {PersistentChampionshipService} from '../apps/server/src/persistent/service.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {trainingRoom} from '../packages/game-core/stages/registry.js';
import {newMatchStatistics} from '../packages/game-core/simulation/MatchStatistics.js';
import {persistentStatistics,type PersistentCreate,type PersistentMode} from '../packages/shared/persistentChampionship.js';
import type {ServerMessage} from '../packages/shared/protocol.js';
const roster=Object.keys(characters).filter(id=>!id.startsWith('prototype'));
function config(mode:PersistentMode='1v1',count=4):PersistentCreate{const size=Number(mode[0]);return {name:'Friends Cup',mode,stage:trainingRoom.id,competitors:Array.from({length:count},(_,i)=>({name:`Team ${i+1}`,fighters:Array.from({length:size},(_,j)=>roster[(i*size+j)%roster.length])}))};}
function stats(mode:PersistentMode='1v1'){const s=newMatchStatistics(Number(mode[0])*2);s.finalized=true;s.players.forEach(p=>{p.damageDealt=100;p.kos=1;p.energySpent=40;});return s;}
for(const mode of ['1v1','2v2','3v3'] as const)for(const count of [4,8,16])test(`persistent ${mode} ${count}: creation, complete bracket, immutable history and statistics`,()=>{const db=new ChampionshipStore(':memory:');try{const {tournament:t,pin}=db.create(config(mode,count));assert.equal(t.series.length,count-1);assert.ok(pin.length>=16);for(let round=0;round<Math.log2(count);round++){for(const s of db.get(t.id).series.filter(s=>s.round===round)){for(let fight=0;fight<2;fight++){const attempt=db.begin(t.id,s.id);assert.equal(db.finalize(attempt,0,stats(mode)),true);assert.equal(db.finalize(attempt,0,stats(mode)),false);}}}const done=db.get(t.id);assert.ok(done.completedAt);assert.equal(done.fights.length,(count-1)*2);assert.equal(db.list(true).cards[0].champion?.id,done.champion);assert.throws(()=>db.remove(t.id,pin),/permanent/);assert.throws(()=>db.begin(t.id,t.series[0].id));const totals=persistentStatistics(done);assert.equal(totals.teams.reduce((n,t)=>n+t.won,0),done.fights.length);assert.equal(totals.fighters.reduce((n,t)=>n+t.won,0),done.fights.length*Number(mode[0]));}finally{db.close();}});
for(const wins of [[0,0],[0,1,0],[1,1],[1,0,1]])test(`BO3 ${wins.join('-')} advances exactly after two wins`,()=>{const db=new ChampionshipStore(':memory:');try{const {tournament:t}=db.create(config());const series=t.series[0];wins.forEach((winner,i)=>{const a=db.begin(t.id,series.id);db.finalize(a,winner,stats());assert.equal(db.get(t.id).series[0].status,i===wins.length-1?'completed':'available');});assert.equal(db.get(t.id).series[0].winner,series.sides[wins.at(-1)!]);}finally{db.close();}});
test('durable scores survive restart; active attempts are cancelled; PIN never public',()=>{const dir=mkdtempSync(join(tmpdir(),'abroz-persistent-')),path=join(dir,'tournaments.sqlite');let db=new ChampionshipStore(path);try{const {tournament:t,pin}=db.create(config());const s=t.series[0];const a=db.begin(t.id,s.id);db.finalize(a,0,stats());const interrupted=db.begin(t.id,s.id);assert.throws(()=>db.begin(t.id,s.id));db.close();db=new ChampionshipStore(path);assert.deepEqual(db.get(t.id).series[0].score,[1,0]);assert.equal(db.finalize(interrupted,1,stats()),false);assert.ok(!JSON.stringify(db.get(t.id)).includes(pin));assert.throws(()=>db.remove(t.id,'wrong'));db.cancel(db.begin(t.id,s.id));db.remove(t.id,pin);assert.throws(()=>db.get(t.id));}finally{db.close();rmSync(dir,{recursive:true});}});
test('invalid names, rosters, duplicate team members and skins rejected',()=>{const db=new ChampionshipStore(':memory:');try{for(const c of [{...config(),name:''},{...config(),mode:'bad'}, {...config(),stage:'missing'}, {...config(),competitors:config().competitors.slice(1)}, {...config('2v2'),competitors:config('2v2').competitors.map(c=>({...c,fighters:['bozo','bozo']}))}, {...config(),competitors:config().competitors.map(c=>({...c,skins:['bad']}))}])assert.throws(()=>db.create(c as PersistentCreate));assert.equal(db.list().cards.length,0);}finally{db.close();}});
for(const mode of ['1v1','2v2','3v3'] as const)test(`${mode} claims, distinct sessions, readiness, concurrent series and interrupted fights`,()=>{const db=new ChampionshipStore(':memory:');try{const t=db.create(config(mode)).tournament,messages=new Map<WebSocket,ServerMessage[]>();const service=new PersistentChampionshipService(db,(s,m)=>{messages.get(s)!.push(m);});const peers=Array.from({length:Number(mode[0])*2+1},()=>{const s={} as WebSocket;messages.set(s,[]);return s;});const s=t.series[0];peers.slice(0,-1).forEach((p,i)=>service.command(p,{type:'persistent',action:'claim',id:t.id,seriesId:s.id,slot:i,session:`temporary-session-${i}`},'local'));assert.throws(()=>service.command(peers.at(-1)!,{type:'persistent',action:'claim',id:t.id,seriesId:s.id,slot:0,session:'another-session-123'},'local'));assert.throws(()=>service.command(peers[0],{type:'persistent',action:'claim',id:t.id,seriesId:t.series[1].id,slot:0,session:'temporary-session-0'},'local'));peers.slice(0,-1).forEach(p=>service.command(p,{type:'persistent',action:'ready',ready:true},'local'));const start=messages.get(peers[0])!.find(m=>m.type==='persistent-start');assert.equal(start?.type,'persistent-start');if(start?.type!=='persistent-start')throw Error('not started');assert.equal(start.characters.length,Number(mode[0])*2);peers.slice(0,-1).forEach(p=>service.input(p,2,0,start.matchId));service.leave(peers[0]);assert.deepEqual(db.get(t.id).series[0].score,[0,0]);assert.equal(db.get(t.id).fights.length,0);assert.ok(messages.get(peers[1])!.some(m=>m.type==='persistent-ended'&&m.cancelled&&!m.snapshot));assert.equal(db.finalize(start.matchId,0,stats(mode)),false);service.command(peers.at(-1)!,{type:'persistent',action:'claim',id:t.id,seriesId:t.series[1].id,slot:0,session:'independent-session'},'local');service.expire(Date.now()+700000);assert.equal(service.has(peers.at(-1)!),false);}finally{db.close();}});

test('server simulation alone finalizes fights; late inputs and disconnect cannot rewrite wins',()=>{
 const db=new ChampionshipStore(':memory:');try{
  const t=db.create(config()).tournament,messages:ServerMessage[][]=[[],[]],peers=[{},{}] as WebSocket[];
  const service=new PersistentChampionshipService(db,(s,m)=>messages[peers.indexOf(s)].push(m));
  peers.forEach((p,i)=>service.command(p,{type:'persistent',action:'claim',id:t.id,seriesId:t.series[0].id,slot:i,session:`authority-session-${i}`},'test'));
  peers.forEach(p=>service.command(p,{type:'persistent',action:'ready',ready:true},'test'));
  const start=messages[0].find(m=>m.type==='persistent-start')!;assert.equal(start.type,'persistent-start');if(start.type!=='persistent-start')return;
  // Arrange a server-side terminal frame. No client API accepts this state or result.
  const l=(service as unknown as {lobbies:Map<string,{match:{simulation:{state:{phase:string;winner:number;statistics:ReturnType<typeof stats>}}}}>}).lobbies.get(t.series[0].id)!;
  l.match.simulation.state.phase='result';l.match.simulation.state.winner=0;l.match.simulation.state.statistics=stats();
  service.input(peers[0],2,0,start.matchId);service.input(peers[1],2,0,start.matchId);
  assert.deepEqual(db.get(t.id).series[0].score,[1,0]);assert.equal(db.get(t.id).fights.length,1);
  const results=messages.map(q=>q.find(m=>m.type==='persistent-ended'));assert.deepEqual(results[0],results[1]);
  assert.ok(results[0]?.type==='persistent-ended'&&results[0].snapshot);
  const terminal=decodeSnapshot(results[0].snapshot);assert.equal(terminal.phase,'result');assert.equal(terminal.winner,0);assert.equal(terminal.statistics?.finalized,true);

  peers.forEach(p=>service.command(p,{type:'persistent',action:'ready',ready:true},'test'));
  const next=messages[0].filter(m=>m.type==='persistent-start').at(-1)!;assert.ok(next.type==='persistent-start');
  assert.notEqual(next.stage,start.stage);assert.ok(messages[1].some(m=>m.type==='persistent-start'&&m.stage===next.stage&&m.matchId===next.matchId));
  service.input(peers[0],3,0,start.matchId);service.leave(peers[1]);assert.deepEqual(db.get(t.id).series[0].score,[1,0]);
  assert.ok(messages[0].some(m=>m.type==='persistent-ended'&&!m.cancelled));
 }finally{db.close();}
});

test('failed database commit rolls back score, statistics and attempt together',()=>{const db=new ChampionshipStore(':memory:');try{const t=db.create(config()).tournament,a=db.begin(t.id,t.series[0].id);db.db.exec("CREATE TRIGGER reject_write BEFORE UPDATE ON tournaments BEGIN SELECT RAISE(ABORT,'test disk failure'); END;");assert.throws(()=>db.finalize(a,0,stats()),/test disk failure/);assert.equal(db.get(t.id).fights.length,0);assert.deepEqual(db.get(t.id).series[0].score,[0,0]);db.db.exec('DROP TRIGGER reject_write');assert.equal(db.finalize(a,0,stats()),true);assert.equal(db.finalize(a,0,stats()),false);}finally{db.close();}});
test('independent series may commit in either order without waiting for the entire round',()=>{const db=new ChampionshipStore(':memory:');try{const t=db.create(config('1v1',8)).tournament;const a=db.begin(t.id,t.series[0].id),b=db.begin(t.id,t.series[1].id);db.finalize(b,1,stats());db.finalize(a,0,stats());db.finalize(db.begin(t.id,t.series[0].id),0,stats());db.finalize(db.begin(t.id,t.series[1].id),1,stats());const now=db.get(t.id);assert.equal(now.series.find(s=>s.round===1&&s.index===0)!.status,'available');assert.equal(now.series.find(s=>s.round===0&&s.index===2)!.status,'available');assert.equal(now.fights.length,4);}finally{db.close();}});

test('persistent victory and statistics retain normal actions with championship continuation',()=>{
 const g=new GameSimulation(['nikalz','luizinho']);g.state.phase='result';g.state.winner=0;g.state.statistics=stats();
 const html=resultScreen(g.state,'online','NIKALZ',()=>'', 'Arena',true);
 assert.match(html,/data-action="online-continue"/);assert.match(html,/Continue Championship/);assert.match(html,/data-action="statistics"/);assert.match(html,/data-action="home"/);
 assert.doesNotMatch(html,/Continue in Room/);
 assert.match(matchStatisticsScreen(g.state,g.state.statistics,true,'overview',0,'',true),/Continue Championship/);
 assert.match(resultScreen(g.state,'online','NIKALZ',()=>''),/Continue in Room/);
});
