import {writeFileSync} from 'node:fs';
import {characters} from '../packages/game-core/characters/registry.js';
import {fighterAudio,assetBriefs} from '../apps/client/src/audio/FighterAudio.js';
import {sounds} from '../apps/client/src/audio/SoundRegistry.js';
const rows=[['Fighter','Move','Material','Phase','Slot','Status','Required sound']];
for(const c of Object.values(characters))for(const m of Object.values(c.moves))for(const phase of ['start','active','impact','end'] as const){
 const profile=fighterAudio[c.id][m.id],id=profile[phase],d=sounds[id];
 rows.push([c.displayName,m.displayName??m.id,profile.family,phase,id,d.assets?.length?'original audio file configured':d.fallback?'synthesized placeholder':'recording needed — silent',assetBriefs[id]]);
}
for(const [id,brief] of Object.entries(assetBriefs))if(id.split('.').length===2)rows.push([id.split('.')[0],id.split('.')[1],'fighter identity',id.split('.')[1],id,sounds[id].fallback?'synthesized placeholder':'recording needed — silent',brief]);
writeFileSync('docs/audio-asset-catalog.csv',rows.map(row=>row.map(v=>'"'+v.replaceAll('"','""')+'"').join(',')).join('\n')+'\n');
console.log(`${Object.keys(fighterAudio).length} fighters, ${Object.values(fighterAudio).reduce((n,m)=>n+Object.keys(m).length,0)} moves, ${rows.length-1} slots`);
