import type {MenuAction} from './GamepadManager.js';
import {controllerTextEntry} from './ControllerTextEntry.js';
export interface NavRect {left:number;right:number;top:number;bottom:number;}
/** Prefer items in the same row/column, then the nearest item in that direction. */
export function directionalIndex(rects:NavRect[],index:number,direction:string):number {
 const from=rects[index],horizontal=direction==='left'||direction==='right',sign=direction==='left'||direction==='up'?-1:1;
 const cx=(from.left+from.right)/2,cy=(from.top+from.bottom)/2;
 let best=-1,score=Infinity;
 rects.forEach((r,i)=>{if(i===index)return;const dx=(r.left+r.right)/2-cx,dy=(r.top+r.bottom)/2-cy;
  const forward=(horizontal?dx:dy)*sign;if(forward<Math.max(2,Math.min(horizontal?from.right-from.left:from.bottom-from.top,horizontal?r.right-r.left:r.bottom-r.top)*.5))return;
  const cross=Math.abs(horizontal?dy:dx),overlap=horizontal?r.bottom>from.top&&r.top<from.bottom:r.right>from.left&&r.left<from.right;
  const cost=forward+cross*2+(overlap?0:10000);if(cost<score){score=cost;best=i;}
 });
 return best;
}
export class MenuNavigation {
 private owner:number|null=null;private lease=0;
 private focus=new Map<string,string>();
 reset(){this.owner=null;this.lease=0;}
 claim(player:number,now:number,scoped=false):boolean{if(!scoped&&this.owner!==player&&now<this.lease)return false;this.owner=player;this.lease=now+500;return true;}
 private key(root:HTMLElement,player:number){return `${root.closest<HTMLElement>('dialog')?.id||root.closest<HTMLElement>('[data-nav-screen]')?.dataset.navScreen||root.dataset?.navScreen||root.id||'screen'}:${player}`;}
 private token(el:HTMLElement){const data=Object.entries(el.dataset).filter(([k])=>k!=='controllerFocus').flat();return el.id||[el.tagName,...data,el.getAttribute?.('href')??'',...(data.length?[]:[el.getAttribute?.('aria-label')??el.textContent?.trim().slice(0,80)??''])].join(':');}
 private controls(root:HTMLElement,allowed:(el:HTMLElement)=>boolean){
  return Array.from(root.querySelectorAll<HTMLElement>('button,select,input:not([type="hidden"]),textarea,a[href],summary,[tabindex="0"]')).filter(el=>!(el as HTMLButtonElement).disabled&&el.getClientRects().length>0&&!el.closest('[hidden],[inert]')&&allowed(el)).sort((a,b)=>Number(!a.closest('main'))-Number(!b.closest('main')));
 }
 sync(root:HTMLElement,player=0,allowed:(el:HTMLElement)=>boolean=()=>true){
  const controls=this.controls(root,allowed);if(!controls.length)return;
  const current=controls.find(el=>el===document.activeElement)??controls.find(el=>this.token(el)===this.focus.get(this.key(root,player)))??controls.find(el=>el.hasAttribute?.('autofocus'))??controls.find(el=>el.getAttribute?.('aria-pressed')==='true'||el.getAttribute?.('aria-checked')==='true')??controls[0];
  this.select(root,player,current);return current;
 }
 private select(root:HTMLElement,player:number,current:HTMLElement){
  this.focus.set(this.key(root,player),this.token(current));
  if(current!==document.activeElement){current.focus({preventScroll:true});current.scrollIntoView({block:'nearest',inline:'nearest'});}
 }
 handle(action:MenuAction,player:number,root:HTMLElement,now:number,back:()=>void,scoped=false,allowed:(el:HTMLElement)=>boolean=()=>true){
  if(!this.claim(player,now,scoped))return;
  if(action==='back'){back();return;}
  const controls=this.controls(root,allowed);if(!controls.length)return;
  let current=controls.find(el=>el===document.activeElement);
  if(!current||scoped)current=controls.find(el=>this.token(el)===this.focus.get(this.key(root,player)))??controls[0];
  this.select(root,player,current);
  if((action==='left'||action==='right')&&(current instanceof HTMLSelectElement||current instanceof HTMLInputElement&&['range','number'].includes(current.type))){
   const delta=action==='right'?1:-1;
   if(current instanceof HTMLSelectElement){const options=Array.from(current.options).filter(o=>!o.disabled);const chosen=options[(options.indexOf(current.selectedOptions[0])+delta+options.length)%options.length];if(chosen)current.value=chosen.value;}
   else {const min=current.min===''?0:Number(current.min),max=current.max===''?100:Number(current.max);current.value=String(Math.min(max,Math.max(min,Number(current.value)+delta*Number(current.step||1))));current.dispatchEvent(new Event('input',{bubbles:true}));}
   current.dispatchEvent(new Event('change',{bubbles:true}));return;
  }
  if(action==='confirm'){
   if(current instanceof HTMLSelectElement){this.handle('right',player,root,now,back,scoped,allowed);return;}
   if(current instanceof HTMLInputElement&&['text','email','search','password','url','tel'].includes(current.type)){
    const field=current;controllerTextEntry(field,value=>{field.value=value;field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));});return;
   }
   current.click();return;
  }
  if(action==='previous'||action==='next'){
   const scroll=root.querySelector<HTMLElement>('.fg-scroll')??current.closest<HTMLElement>('.controller-page,.page')??root;
   scroll.scrollBy?.({top:(action==='next'?1:-1)*scroll.clientHeight*.65,behavior:'smooth'});return;
  }
  if(['left','right','up','down'].includes(action)){
   const rects=controls.map(el=>el.getBoundingClientRect?.());
   const next=rects.every(Boolean)?directionalIndex(rects,controls.indexOf(current),action):-1;
   // No wraparound surprises; shoulders can page long manuals independently.
   if(next>=0)current=controls[next];
   else if(!rects.every(Boolean))current=controls[(controls.indexOf(current)+(action==='left'||action==='up'?-1:1)+controls.length)%controls.length];
   this.select(root,player,current);
  }
 }
}
