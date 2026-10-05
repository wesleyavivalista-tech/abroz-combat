import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
test('shared simulation and combat stay independent of fighter identities and browser APIs',()=>{
 for(const folder of ['simulation','combat']){
  const dir=new URL(`../packages/game-core/${folder}/`,import.meta.url);
  for(const file of readdirSync(dir).filter(f=>f.endsWith('.ts'))){
   const source=readFileSync(new URL(file,dir),'utf8');
   assert.doesNotMatch(source,/characterId\s*[!=]==?\s*['"]|characters\.(roms|caio|drupa|gut|bozo|tocha)\b/,file);
   assert.doesNotMatch(source,/Math\.random\s*\(|Date\.now\s*\(|performance\.now\s*\(|from ['"]three|from ['"].*apps\/client/,file);
  }
 }
});
