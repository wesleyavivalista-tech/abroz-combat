import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {characters} from '../packages/game-core/characters/registry.js';
import {fighterGuideScreen,fighterGuides} from '../apps/client/src/ui/FighterGuide.js';
import {fighterPresentation} from '../apps/client/src/ui/FighterPresentation.js';
import {resultScreen} from '../apps/client/src/ui/ResultScreen.js';
import {GameSimulation} from '../packages/game-core/simulation/GameSimulation.js';
const bindings=['KeyA','KeyD','KeyW','KeyS','KeyJ','KeyK','KeyL','KeyI','KeyU','KeyO','KeyP'];
test('every playable move, including transformed attacks, has an explanation in the guide',()=>{
 for(const c of Object.values(characters)){
  const html=fighterGuideScreen(c.id,undefined,bindings);
  for(const move of Object.keys(c.moves)){
   assert.ok(fighterGuides[c.id].moves[move]?.length>25,`${c.id}/${move} needs a description`);
   assert.ok(html.includes(fighterGuides[c.id].moves[move]),`${c.id}/${move} missing from page`);
  }
  assert.ok(!html.includes('undefined'));
 }
});
test('guide controls use supplied mappings, including held attacks and double jump',()=>{
 const custom=bindings.map((_,i)=>'F'+(i+1));
 const gut=fighterGuideScreen('gut','kung-fu',custom,1).replace(/<kbd[^>]*>/g,'<kbd>'),drupa=fighterGuideScreen('drupa',undefined,custom,1).replace(/<kbd[^>]*>/g,'<kbd>');
 assert.ok(gut.includes('HOLD <kbd>F9</kbd>'));
 assert.ok(drupa.includes('HOLD <kbd>F6</kbd>'));
 assert.ok(gut.includes('<kbd>F3</kbd><kbd>F3</kbd><i>then</i><kbd>F6</kbd>'));
 assert.ok(!gut.includes('<kbd>J</kbd>'));
});
test('every winner uses existing dedicated victory artwork for either skin',()=>{
 for(const c of Object.values(characters))for(const skin of c.skins??[]){
  const p=fighterPresentation(c.id,skin.id);
  assert.ok(p.victoryPortrait&&existsSync('apps/client/public'+p.victoryPortrait));
  assert.notEqual(p.victoryPortrait,p.portrait);
  const s=new GameSimulation([c.id,'gut']).state;s.winner=0;s.skins[0]=skin.id;
  const html=resultScreen(s,'local',c.displayName,()=> '');
  assert.ok(html.includes(p.victoryPortrait));assert.ok(!html.includes(p.portrait));
 }
});
