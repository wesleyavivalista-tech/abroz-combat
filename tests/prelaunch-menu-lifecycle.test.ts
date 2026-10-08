import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import ts from 'typescript';
import {t} from '../apps/client/src/i18n/index.js';
import {errorMessage} from '../apps/client/src/i18n/errors.js';

// Execute the real main.ts handlers, without constructing WebGL/audio or starting
// its animation loop. Browser checks separately cover native dialog behavior.
const source=ts.createSourceFile('main.ts',readFileSync(new URL('../apps/client/src/main.ts',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true);
const names=new Set(['closeSettings','refreshBindings','disconnectMessage','pause','toggleOnlineControllerMenu','controllerBack']);
const handlers=source.statements.filter(s=>ts.isFunctionDeclaration(s)&&s.name&&names.has(s.name.text)||ts.isExpressionStatement(s)&&ts.isCallExpression(s.expression)&&s.expression.expression.getText(source)==='ui.onAction');
const script=ts.transpileModule(handlers.map(s=>s.getText(source)).join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
class Element extends EventTarget {
 id='';className='';textContent='';dataset:Record<string,string>={};children:Element[]=[];removed=false;focused=false;
 append(...children:Element[]){this.children.push(...children);}
 remove(){this.removed=true;}
 focus(){this.focused=true;}
}
// Node's EventTarget needs an options object to remove a capturing listener;
// browsers also support the boolean argument used by the application.
class BrowserEvents extends EventTarget {
 override removeEventListener(type:string,listener:EventListenerOrEventListenerObject|null,options?:boolean|EventListenerOptions){
  super.removeEventListener(type,listener,typeof options==='boolean'?{capture:options}:options);
 }
}
function fixture(){
 const root=new Element(),settings=new Element(),binding=new Element(),other=new Element();
 settings.id='settings-dialog';root.append(settings);binding.dataset={player:'0',index:'0'};other.dataset={player:'1',index:'0'};
 binding.textContent='KeyA';other.textContent='ArrowLeft';
 const find=(root:Element,id:string):Element|null=>root.removed?null:root.id===id?root:root.children.map(c=>find(c,id)).find(Boolean)??null;
 const input={enabled:false,bindings:[['KeyA'],['ArrowLeft']],clears:0,saves:0,clear(){this.clears++;},save(){this.saves++;}};
 const ui={root:Object.assign(root,{querySelectorAll:()=>[binding,other]}),render:()=>{root.children=[];},onAction:(fn:unknown)=>{context.action=fn;}};
 const context=createContext({ui,input,window:new BrowserEvents(),document:{getElementById:(id:string)=>find(root,id),createElement:()=>new Element()},audio:{unlock(){},play(){}},actionSound:()=>'',controllerHints:{active:false},menuNavigation:{reset(){}},network:{disconnect(){}},cancelBinding:undefined,controllerPanel:false,onlineControllerMenu:true,paused:true,screen:'fight',mode:'online',viewRevision:0,home:()=>{context.wentHome=true;},settings:()=>{throw new Error('Must not navigate away from the paused match');}});
 Object.assign(context,{t,errorMessage});
 runInContext(script,context);
 const key=(code:string)=>{const event=new Event('keydown',{cancelable:true});Object.defineProperties(event,{code:{value:code},repeat:{value:false}});context.window.dispatchEvent(event);};
 return {context,input,root,settings,binding,other,key};
}
test('pause-menu rebinding preserves the match and updates both swapped labels',()=>{
 const {context:c,input,binding,other,key}=fixture();c.action('bind',binding);key('ArrowLeft');
 assert.equal(c.screen,'fight');assert.equal(c.paused,true);assert.equal(input.enabled,false);
 assert.equal(input.bindings[0][0],'ArrowLeft');assert.equal(input.bindings[1][0],'KeyA');
 assert.equal(binding.textContent,'ArrowLeft');assert.equal(other.textContent,'KeyA');assert.equal(c.cancelBinding,undefined);
 key('KeyD');assert.equal(input.saves,1);
});
test('closing settings cancels keyboard capture before subsequent game input',()=>{
 for(const path of ['button','back']){
  const {context:c,input,binding,settings,key}=fixture();c.action('bind',binding);
  if(path==='button')c.action('settings-close',binding);else c.controllerBack();
  assert.ok(settings.removed);assert.equal(c.cancelBinding,undefined);key('KeyD');
  assert.equal(input.bindings[0][0],'KeyA');assert.equal(input.saves,0);
 }
});
test('disconnect clears old menus and capture, locks gameplay and focuses recovery',()=>{
 const {context:c,input,root,binding,key}=fixture();c.action('bind',binding);c.disconnectMessage('Lost connection');
 assert.equal(c.onlineControllerMenu,false);assert.equal(input.enabled,false);assert.equal(c.paused,true);assert.equal(c.cancelBinding,undefined);
 assert.equal(root.children.length,1);const overlay=root.children[0];assert.equal(overlay.id,'disconnect');
 assert.ok(overlay.children[0].children[2].focused);key('KeyD');assert.equal(input.saves,0);
 c.pause();c.toggleOnlineControllerMenu();assert.equal(input.enabled,false);assert.equal(c.onlineControllerMenu,false);
 c.disconnectMessage('Repeated loss');assert.equal(root.children.length,1);
 c.controllerBack();assert.equal(c.wentHome,true);
});
