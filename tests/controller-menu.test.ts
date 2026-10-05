import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MenuNavigation,directionalIndex} from '../apps/client/src/input/MenuNavigation.js';
class Control {
 id:string;tagName='BUTTON';dataset={};disabled=false;clicked=0;focused=false;main=true;
 constructor(id:string){this.id=id;}
 getClientRects(){return [{}];}closest(selector:string){return selector==='main'&&this.main?this:null;}
 focus(){this.focused=true;Object.defineProperty(document,"activeElement",{configurable:true,value:this});}
 scrollIntoView(){}click(){this.clicked++;}
}
// Lightweight DOM boundary fixtures exercise ownership/navigation, not browser layout.
function fixture(run:(controls:Control[],menu:MenuNavigation,root:HTMLElement)=>void){
 const names=['document','HTMLSelectElement','HTMLInputElement'] as const;
 const old=names.map(n=>Object.getOwnPropertyDescriptor(globalThis,n));
 Object.defineProperty(globalThis,'document',{configurable:true,value:{activeElement:null}});
 Object.defineProperty(globalThis,'HTMLSelectElement',{configurable:true,value:class {}});
 Object.defineProperty(globalThis,'HTMLInputElement',{configurable:true,value:class {}});
 const controls=[new Control('resume'),new Control('rematch'),new Control('home')];
 try{run(controls,new MenuNavigation(),{dataset:{navScreen:'test'},closest:()=>null,querySelectorAll:()=>controls} as unknown as HTMLElement);}finally{names.forEach((n,i)=>{if(old[i])Object.defineProperty(globalThis,n,old[i]!);else Reflect.deleteProperty(globalThis,n);});}
}
test('general menus arbitrate simultaneous devices and allow handoff after idle',()=>fixture((c,m,root)=>{m.handle('down',0,root,0,()=>{});assert.equal(c[1].focused,true);m.handle('down',1,root,100,()=>{});assert.equal(c[2].focused,false);m.handle('down',1,root,600,()=>{});assert.equal(c[2].focused,true);}));
test('results/rematch and pause buttons activate once per logical confirm',()=>fixture((c,m,root)=>{m.handle('down',0,root,0,()=>{});m.handle('confirm',0,root,100,()=>{});assert.equal(c[1].clicked,1);assert.equal(c[0].clicked,0);assert.equal(c[2].clicked,0);}));
test('scoped player navigation cannot select another player control',()=>fixture((c,m,root)=>{m.handle('confirm',1,root,0,()=>{},true,el=>el.id==='rematch');assert.equal(c[1].clicked,1);assert.equal(c[0].clicked,0);assert.equal(c[2].clicked,0);}));
test('main actions precede header back buttons for controller entry',()=>fixture((c,m,root)=>{c[0].main=false;m.handle('confirm',0,root,0,()=>{});assert.equal(c[1].clicked,1);assert.equal(c[0].clicked,0);}));
test('back routing and menu reset release old ownership',()=>fixture((_c,m,root)=>{let backs=0;m.handle('back',0,root,0,()=>backs++);m.handle('back',1,root,1,()=>backs++);assert.equal(backs,1);m.reset();m.handle('back',1,root,2,()=>backs++);assert.equal(backs,2);}));

test('directional navigation follows grid columns rather than DOM order',()=>{
 const r=(x:number,y:number)=>({left:x,right:x+80,top:y,bottom:y+40});
 const grid=[r(0,0),r(100,0),r(200,0),r(0,60),r(100,60),r(200,60)];
 assert.equal(directionalIndex(grid,1,'down'),4);assert.equal(directionalIndex(grid,4,'up'),1);
 assert.equal(directionalIndex(grid,1,'right'),2);assert.equal(directionalIndex(grid,0,'left'),-1);
});
test('returning to a screen restores selection after ownership reset',()=>fixture((c,m,root)=>{
 m.handle('down',0,root,0,()=>{});m.reset();Object.defineProperty(document,'activeElement',{configurable:true,value:null});
 m.handle('confirm',0,root,900,()=>{});assert.equal(c[1].clicked,1);
}));

test('angled cards in one row do not steal vertical navigation',()=>{
 const rects=[{left:0,right:80,top:0,bottom:100},{left:90,right:170,top:5,bottom:105},{left:0,right:300,top:120,bottom:160}];
 assert.equal(directionalIndex(rects,0,'down'),2);
});
