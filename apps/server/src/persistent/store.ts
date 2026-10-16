import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,chmodSync} from 'node:fs';
import {dirname} from 'node:path';
import {randomUUID,randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
import {characters} from '../../../../packages/game-core/characters/registry.js';
import {stages} from '../../../../packages/game-core/stages/registry.js';
import {createChampionship} from '../../../../packages/game-core/tournament/Championship.js';
import type {MatchStatistics} from '../../../../packages/game-core/simulation/MatchStatistics.js';
import type {PersistentCreate,PersistentTournament,PersistentCard} from '../../../../packages/shared/persistentChampionship.js';
/** One server owns this database on its persistent volume. Never use the deployment root. */
export class ChampionshipStore {
 readonly db:DatabaseSync;
 constructor(path:string){
  if(path!==':memory:')mkdirSync(dirname(path),{recursive:true,mode:0o700});this.db=new DatabaseSync(path);if(path!==':memory:')chmodSync(path,0o600);
  this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  const v=Number((this.db.prepare('PRAGMA user_version').get() as {user_version:number}).user_version);if(v>1)throw Error('Championship database schema is newer than this server');
  if(v===0)this.db.exec(`BEGIN IMMEDIATE;
   CREATE TABLE tournaments(id TEXT PRIMARY KEY, created INTEGER NOT NULL, completed INTEGER, public_json TEXT NOT NULL, summary_json TEXT NOT NULL, salt TEXT NOT NULL, pin_hash BLOB NOT NULL);
   CREATE INDEX tournament_browser ON tournaments(completed,created);
   CREATE TABLE attempts(id TEXT PRIMARY KEY, tournament TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE, series TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('active','cancelled','finalized')), created INTEGER NOT NULL);
   CREATE UNIQUE INDEX one_live_fight ON attempts(tournament,series) WHERE status='active';
   PRAGMA user_version=1; COMMIT;`);
  // A new process has no valid connections. Never resume unfinished fights as wins.
  this.db.exec("UPDATE attempts SET status='cancelled' WHERE status='active'");
 }
 close(){this.db.close();}
 transaction<T>(fn:()=>T):T{this.db.exec('BEGIN IMMEDIATE');try{const result=fn();this.db.exec('COMMIT');return result;}catch(e){this.db.exec('ROLLBACK');throw e;}}
 get(id:string):PersistentTournament {if(typeof id!=='string'||id.length>100)throw Error('Invalid championship');const r=this.db.prepare('SELECT public_json FROM tournaments WHERE id=?').get(id) as {public_json:string}|undefined;if(!r)throw Error('Championship not found');return JSON.parse(r.public_json);}
 list(completed=false,offset=0){if(!Number.isInteger(offset)||offset<0||offset>100000)throw Error('Invalid page');const rows=this.db.prepare(`SELECT summary_json FROM tournaments WHERE completed IS ${completed?'NOT ':''}NULL ORDER BY created DESC,id LIMIT 25 OFFSET ?`).all(offset) as {summary_json:string}[];return {cards:rows.slice(0,24).map(r=>JSON.parse(r.summary_json) as PersistentCard),hasMore:rows.length>24};}
 private summary(t:PersistentTournament):string{return JSON.stringify({id:t.id,name:t.name,mode:t.mode,createdAt:t.createdAt,completedAt:t.completedAt,count:t.competitors.length,completed:t.series.filter(s=>s.status==='completed').length,total:t.series.length,available:t.series.filter(s=>s.status==='available').length,champion:t.competitors.find(c=>c.id===t.champion)??null} satisfies PersistentCard);}
 private save(t:PersistentTournament){t.version++;this.db.prepare('UPDATE tournaments SET public_json=?,summary_json=?,completed=? WHERE id=?').run(JSON.stringify(t),this.summary(t),t.completedAt,t.id);}
 create(config:PersistentCreate){
  if(!config||typeof config.name!=='string'||config.name.trim().length<3||config.name.length>60||[...config.name].some(c=>c.charCodeAt(0)<32))throw Error('Choose a championship name with 3–60 characters');
  const size=({'1v1':1,'2v2':2,'3v3':3} as const)[config.mode];if(!size||!Object.hasOwn(stages,config.stage)||!Array.isArray(config.competitors)||![4,8,16].includes(config.competitors.length))throw Error('Invalid championship configuration');
  const competitors=config.competitors.map((c,id)=>{if(!c||typeof c.name!=='string'||c.name.length>40||!Array.isArray(c.fighters)||c.fighters.length!==size||new Set(c.fighters).size!==size||c.fighters.some(f=>typeof f!=='string'||!Object.hasOwn(characters,f)||f.startsWith('prototype')))throw Error('Choose distinct playable fighters within each team');const skins=c.skins??c.fighters.map(()=>'original');if(skins.length!==size||skins.some((s,i)=>s!=='original'&&!characters[c.fighters[i]].skins?.some(k=>k.id===s)))throw Error('Invalid outfit');return {id,name:c.name.trim()||c.fighters.map(f=>characters[f].displayName).join(' + '),fighters:c.fighters,skins};});
  if(size===1&&new Set(competitors.map(c=>c.fighters[0])).size!==competitors.length)throw Error('Choose distinct fighters for 1v1');
  const bracket=createChampionship(competitors.map(c=>({id:c.id,name:c.name,character:c.fighters[0],skin:c.skins[0]})));
  const t:PersistentTournament={id:randomUUID(),name:config.name.trim(),mode:config.mode,stage:config.stage,createdAt:Date.now(),completedAt:null,competitors,series:bracket.rounds.flatMap(round=>round.map((s,index)=>({id:randomUUID(),round:s.round,index,sides:s.slots,score:[0,0],winner:null,status:s.round===0?'available':'waiting'}))),fights:[],champion:null,version:1};
  const pin=randomBytes(9).toString('hex').toUpperCase(),salt=randomBytes(16).toString('hex'),hash=scryptSync(pin,salt,32);
  this.db.prepare('INSERT INTO tournaments VALUES(?,?,?,?,?,?,?)').run(t.id,t.createdAt,null,JSON.stringify(t),this.summary(t),salt,hash);return {tournament:t,pin};
 }
 begin(id:string,seriesId:string){return this.transaction(()=>{const t=this.get(id),s=t.series.find(s=>s.id===seriesId);if(t.completedAt||s?.status!=='available')throw Error('Series is not available');const attempt=randomUUID();this.db.prepare("INSERT INTO attempts VALUES(?,?,?,'active',?)").run(attempt,id,seriesId,Date.now());return attempt;});}
 cancel(attempt:string){this.db.prepare("UPDATE attempts SET status='cancelled' WHERE id=? AND status='active'").run(attempt);}
 finalize(attempt:string,winnerSide:number,statistics:MatchStatistics):boolean {
  return this.transaction(()=>{const a=this.db.prepare('SELECT * FROM attempts WHERE id=?').get(attempt) as {tournament:string;series:string;status:string}|undefined;if(!a||a.status!=='active')return false;
   const t=this.get(a.tournament),s=t.series.find(s=>s.id===a.series)!;
   if(!statistics.finalized||![0,1].includes(winnerSide)||s.status!=='available'||t.completedAt)throw Error('Invalid authoritative result');
   const count=t.competitors[0].fighters.length*2;if(statistics.players.length!==count)throw Error('Invalid statistics');
   t.fights.push({id:attempt,seriesId:s.id,number:s.score[0]+s.score[1]+1,winner:s.sides[winnerSide]!,completedAt:Date.now(),statistics:structuredClone(statistics.players),elapsedFrames:statistics.elapsedFrames});s.score[winnerSide]++;
   if(s.score[winnerSide]===2){s.status='completed';s.winner=s.sides[winnerSide];const next=t.series.find(n=>n.round===s.round+1&&n.index===Math.floor(s.index/2));if(next){next.sides[s.index%2]=s.winner;if(next.sides.every(n=>n!==null))next.status='available';}else{t.champion=s.winner;t.completedAt=Date.now();}}
   this.save(t);this.db.prepare("UPDATE attempts SET status='finalized' WHERE id=?").run(attempt);return true;
  });
 }
 remove(id:string,pin:string){if(typeof pin!=='string'||pin.length>64)throw Error('Invalid management PIN');return this.transaction(()=>{const t=this.get(id);if(t.completedAt)throw Error('Completed championships are permanent');const r=this.db.prepare('SELECT salt,pin_hash FROM tournaments WHERE id=?').get(id) as {salt:string;pin_hash:Uint8Array};if(!timingSafeEqual(scryptSync(pin.trim().toUpperCase(),r.salt,32),r.pin_hash))throw Error('Invalid management PIN');this.db.prepare('DELETE FROM tournaments WHERE id=?').run(id);});}
}
