import {test} from 'node:test';
import assert from 'node:assert/strict';
import {en, type Message} from '../apps/client/src/i18n/en.js';
import {ptBR} from '../apps/client/src/i18n/pt-BR.js';
import {detectLocale, escapeText, formatNumber, LocalePreference, localeStorageKey, translate, setLocale} from '../apps/client/src/i18n/index.js';
import {homeScreen, localGameScreen, selectionScreen} from '../apps/client/src/ui/MenuScreens.js';
import {arenaSelection} from '../apps/client/src/ui/ArenaSelection.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {stages} from '../packages/game-core/stages/registry.js';
import {fighterSkins} from '../packages/game-core/characters/skins.js';
import {skinName} from '../apps/client/src/i18n/content.js';
import {guidesEn} from '../apps/client/src/i18n/guides-en.js';
import {guidesPtBR} from '../apps/client/src/i18n/guides-pt-BR.js';
import {fighterGuideScreen} from '../apps/client/src/ui/FighterGuide.js';
import {errorMessage} from '../apps/client/src/i18n/errors.js';

test('localization resources have identical keys, variants and interpolation placeholders', () => {
  assert.deepEqual(Object.keys(ptBR).sort(), Object.keys(en).sort());
  const parts = (value: Message) => typeof value === 'string' ? [value] : [value.one, value.other];
  const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
  for (const key of Object.keys(en) as (keyof typeof en)[]) {
    assert.equal(typeof ptBR[key], typeof en[key], key);
    parts(en[key]).forEach((english, index) => {
      const portuguese = parts(ptBR[key])[index];
      assert.ok(portuguese.trim().length, key);
      assert.deepEqual(placeholders(portuguese), placeholders(english), key);
    });
  }
});

test('locale detection handles language priority, unsupported and malformed values', () => {
  assert.equal(detectLocale(['pt-BR','en-US']), 'pt-BR');
  assert.equal(detectLocale(['en-US','pt-BR']), 'en');
  assert.equal(detectLocale('pt-br'), 'pt-BR');
  for (const value of [undefined, null, {}, 123, 'pt', 'pt-PT', 'pt-BR<script>', ['fr-FR']]) assert.equal(detectLocale(value), 'en');
});

test('language choice persists independently and bad storage never blocks play', () => {
  const values = new Map([['afterglow-controls','unchanged'], ['abroz-audio','unchanged']]);
  const store = {getItem:(key:string)=>values.get(key)??null, setItem:(key:string,value:string)=>{values.set(key,value);}};
  const first = new LocalePreference(store, ['pt-BR']);
  assert.equal(first.value,'pt-BR');
  first.set('en');
  assert.equal(new LocalePreference(store,['pt-BR']).value,'en');
  assert.equal(values.get('afterglow-controls'),'unchanged');
  assert.equal(values.get('abroz-audio'),'unchanged');
  values.set(localeStorageKey,'{"broken":true}');
  assert.equal(new LocalePreference(store,['pt-BR']).value,'pt-BR');
  const unavailable = new LocalePreference({getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}}, ['en']);
  assert.equal(unavailable.set('pt-BR'),true);
  assert.equal(unavailable.value,'pt-BR');
  assert.equal(unavailable.set('bad'),false);
  assert.equal(unavailable.value,'pt-BR');
});

test('switch notifications are deduplicated and unsubscribed listeners are cleaned up', () => {
  const writes:string[]=[];
  const choice = new LocalePreference({getItem:()=>null,setItem:(_key,value)=>{writes.push(value);}},['en']);
  let calls=0;
  const dispose=choice.subscribe(()=>calls++);
  choice.set('en');
  choice.set('pt-BR');
  choice.set('pt-BR');
  assert.equal(calls,1);
  assert.equal(writes[0],'en');
  dispose();choice.set('en');assert.equal(calls,1);
});

test('formatting supports English fallback, plurals, accents and safe HTML interpolation', () => {
  assert.equal(translate('pt-BR','nav.settings'), 'CONFIGURAÇÕES');
  assert.equal(translate('pt-BR','nav.settings',{},{}), 'SETTINGS');
  assert.equal(translate('en','common.players',{count:1}), '1 player');
  assert.equal(translate('pt-BR','common.players',{count:2}), '2 jogadores');
  assert.equal(formatNumber(12.5,'pt-BR'), '12,5');
  assert.equal(formatNumber(12.5,'en'), '12.5');
  assert.equal(escapeText(translate('pt-BR','common.player',{player:'<img onerror="x">'})), 'Jogador &lt;img onerror=&quot;x&quot;&gt;');
});

test('independent clients can use different locales without sharing any gameplay state', () => {
  const store=()=>({getItem:()=>null,setItem:()=>{}});
  const left=new LocalePreference(store(),['en']), right=new LocalePreference(store(),['pt-BR']);
  assert.equal(translate(left.value,'common.player',{player:1}),'Player 1');
  assert.equal(translate(right.value,'common.player',{player:1}),'Jogador 1');
  left.set('pt-BR');right.set('en');
  assert.equal(left.value,'pt-BR');assert.equal(right.value,'en');
});

test('translated menus preserve actions, fighter identities, skins and arena identities on repeated switches', () => {
  const definitions=JSON.stringify({characters,stages});
  const render=()=>[homeScreen(),localGameScreen(),selectionScreen('local',['nikalz','jopa'],1,false,'nikalz'),...Object.keys(stages).map(id=>arenaSelection(id,'local',['nikalz','jopa'],['original','original']))];
  const identifiers=(html:string)=>[...html.matchAll(/(?:data-(?:action|id|arena)|value|src)="([^"]*)"/g)].map(m=>m[0]);
  try {
    setLocale('en');const english=render();
    setLocale('pt-BR');const portuguese=render();
    assert.ok(portuguese[0].includes('Três vidas. Um sobrevivente.'));
    assert.ok(portuguese[2].includes('CONFIRMAR JOGADOR 2'));
    for(let i=0;i<english.length;i++)assert.deepEqual(identifiers(portuguese[i]),identifiers(english[i]));
    for(const fighter of Object.values(characters)){
      assert.ok(portuguese[2].includes(fighter.displayName));
      for(const skin of fighterSkins(fighter))assert.ok(Object.hasOwn(ptBR,`skin.${fighter.id}.${skin.id}`),`Unreviewed skin: ${fighter.id}/${skin.id}`);
    }
    assert.equal(skinName('caio',{id:'black',name:'Blackout'}),'Blackout');
    assert.equal(skinName('drupa',{id:'purple',name:'Heavyweight purple'}),'Heavyweight purple');
    setLocale('en');assert.deepEqual(render(),english);
    assert.equal(JSON.stringify({characters,stages}),definitions);
  } finally {setLocale('en');}
});

test('all sixteen fighter guides cover every move and preserve every original move name',()=>{
  assert.deepEqual(Object.keys(guidesPtBR).sort(),Object.keys(guidesEn).sort());
  const bindings=['KeyA','KeyD','KeyW','KeyS','KeyJ','KeyK','KeyL','KeyI','KeyU','KeyO','KeyP'];
  try{
    for(const id of Object.keys(guidesEn) as (keyof typeof guidesEn)[]){
      const original=guidesEn[id],translated=guidesPtBR[id];
      assert.deepEqual(Object.keys(translated.moves).sort(),Object.keys(original.moves).sort(),id);
      assert.equal(translated.traits.length,original.traits.length,id);
      setLocale('en');
      const englishPage=fighterGuideScreen(id,undefined,bindings);
      setLocale('pt-BR');
      const page=fighterGuideScreen(id,undefined,bindings);
      assert.ok(page.includes('CONHEÇA SEU LUTADOR'));
      assert.ok(!page.includes('undefined')&&!page.includes('${'));
      for(const move of Object.values(characters[id].moves))assert.ok(page.includes(escapeText(move.displayName??move.id)),`${id}: ${move.displayName}`);
      for(const [moveId,description] of Object.entries(translated.moves)){
        // The original guide contains some unused legacy move descriptions.
        // Preserve which cards are shown instead of exposing new moves.
        const wasVisible=englishPage.includes(escapeText(original.moves[moveId as keyof typeof original.moves]));
        assert.equal(page.includes(escapeText(description)),wasVisible,`${id}/${moveId}: description visibility changed`);
      }
    }
    assert.ok(guidesPtBR.bozo.traits[0].includes('Bunda de Pelucia'));
    assert.ok(guidesPtBR.eide.traits[3].includes('Suco lover'));
  }finally{setLocale('en');}
});

test('network errors are localized only for presentation and unfamiliar messages remain safe',()=>{
  try{
    setLocale('pt-BR');
    assert.equal(errorMessage('Room not found'),'Sala não encontrada');
    assert.equal(errorMessage('Room size must be 2–16 fighters'),'A sala deve ter de 2 a 16 lutadores');
    assert.equal(errorMessage('Cannot connect to room server on wss://example.test'),'Não foi possível conectar ao servidor de salas em wss://example.test');
    for(const unknown of ['Unknown future error','toString','constructor','__proto__'])assert.equal(errorMessage(unknown),unknown);
    setLocale('en');assert.equal(errorMessage('Room not found'),'Room not found');
  }finally{setLocale('en');}
});

test('named ability HUD cues retain their original names while surrounding instructions translate',()=>{
  for(const [key,name] of [
    ['status.onFire','ON FIRE'],['status.bravinho','BRAVINHO'],
    ['energy.loan','LOAN'],['jomp.cool','COOL MUSCLES'],['jomp.locked','GYM BRO'],
  ] as const){
    assert.ok(translate('pt-BR',key,{seconds:3,hits:2,bonus:30,player:1}).startsWith(name),key);
  }
  assert.equal(translate('pt-BR','status.onFire',{seconds:3}),'ON FIRE · 3s · +50% VELOCIDADE');
});
