import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ChampionshipStore} from '../apps/server/src/persistent/store.js';
import {initialPersistentConfig,randomizePersistentBracket,persistentBracketPreview,persistentBrowser,persistentCreate,persistentDetail} from '../apps/client/src/ui/PersistentChampionship.js';
import {newMatchStatistics} from '../packages/game-core/simulation/MatchStatistics.js';
test('creation offers all team slots and controller-compatible native inputs',()=>{for(const mode of ['1v1','2v2','3v3'] as const)for(const count of [4,8,16]){const html=persistentCreate(initialPersistentConfig(mode,count));assert.equal((html.match(/data-pc-fighter=/g)??[]).length,count*Number(mode[0]));assert.equal((html.match(/data-pc-skin=/g)??[]).length,count*Number(mode[0]));assert.match(html,/maxlength="60"/);assert.match(html,/data-pc="save"/);}});
test('public rendering escapes user text; golden history uses confirmed team and immutable stats',()=>{const db=new ChampionshipStore(':memory:');try{const c=initialPersistentConfig('2v2');c.name='<img src=x onerror=alert(1)>';c.competitors[0].name='<script>bad</script>';const {tournament:t}=db.create(c);assert.ok(!persistentDetail(t,[],null,'bracket','','').includes('<script>'));for(let round=0;round<2;round++)for(const s of db.get(t.id).series.filter(s=>s.round===round))for(let n=0;n<2;n++){const stats=newMatchStatistics(4);stats.finalized=true;db.finalize(db.begin(t.id,s.id),0,stats);}const done=db.get(t.id),html=persistentDetail(done,[],null,'stats','','');assert.match(html,/pc-winner/);assert.doesNotMatch(html,/pc-winner-background/);assert.doesNotMatch(html,/data-pc="manage"/);assert.match(html,/Team totals/);const cards=persistentBrowser(db.list(true).cards,true,0,false);assert.match(cards,/pc-gold/);assert.match(cards,/pc-team-art/);assert.doesNotMatch(cards,/pc-trophy-art/);assert.match(cards,/&lt;img/);}finally{db.close();}});

test('bracket shuffle preserves whole teams and preview matches the saved first round',()=>{
 for(const mode of ['1v1','2v2','3v3'] as const)for(const count of [4,8,16]){
  const c=initialPersistentConfig(mode,count);c.name='Shuffle test';c.competitors.forEach((team,i)=>team.name=`Team ${i}`);
  const before=structuredClone(c),shuffled=randomizePersistentBracket(c,()=>0);
  assert.deepEqual(c,before);assert.notDeepEqual(shuffled.competitors,c.competitors);
  assert.equal(new Set(shuffled.competitors).size,count);
  for(const team of c.competitors)assert.ok(shuffled.competitors.includes(team));
  const db=new ChampionshipStore(':memory:');try{
   const {tournament}=db.create(shuffled);
   const names=tournament.series.filter(s=>s.round===0).flatMap(s=>s.sides.map(id=>tournament.competitors.find(t=>t.id===id)!.name));
   const preview=persistentBracketPreview(shuffled);
   assert.deepEqual([...preview.matchAll(/<strong>(.*?)<\/strong>/g)].map(m=>m[1]),names);
   assert.equal((preview.match(/pc-preview-match"/g)??[]).length,count/2);
   const html=persistentCreate(shuffled);assert.match(html,/data-pc="shuffle"/);assert.match(html,/aria-live="polite"/);
  }finally{db.close();}
 }
});
test('shuffle preview escapes custom team names',()=>{
 const c=initialPersistentConfig('2v2');c.competitors[0].name='<script>bad</script>';
 assert.match(persistentBracketPreview(c),/&lt;script&gt;/);assert.doesNotMatch(persistentBracketPreview(c),/<script>/);
});
