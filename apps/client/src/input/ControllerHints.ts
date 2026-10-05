import {controllerButtonName,type ControllerDevice} from './GamepadManager.js';
export class ControllerHints {
 active=false;brand:ControllerDevice['brand']='generic';
 private abort=new AbortController();private bar=document.createElement('div');
 constructor(){
  this.bar.className='controller-hints';this.bar.hidden=true;document.body.append(this.bar);
  for(const event of ['pointerdown','keydown'])document.addEventListener(event,()=>{this.active=false;document.documentElement.dataset.inputDevice='keyboard';this.bar.hidden=true;},{signal:this.abort.signal});
 }
 use(brand:ControllerDevice['brand']){this.active=true;this.brand=brand;document.documentElement.dataset.inputDevice='controller';}
 button(index:number){return controllerButtonName(index,this.brand);}
 update(gameplay:boolean,selection:boolean){
  const dialogs=document.querySelectorAll('dialog[open]');const parent=dialogs[dialogs.length-1]??document.body;
  if(this.bar.parentElement!==parent)parent.append(this.bar);
  this.bar.hidden=!this.active;
  const current=document.activeElement;
  const adjust=current instanceof HTMLSelectElement||current instanceof HTMLInputElement&&['range','number'].includes(current.type);
  const text=gameplay?`${this.button(9)}  Pause / options`:`D-pad / stick  Navigate   ${adjust?'← →  Adjust   ':''}${this.button(0)}  ${current instanceof HTMLInputElement&&current.type==='text'?'Enter text':'Confirm'}   ${this.button(1)}  Back / cancel   ${this.button(4)} / ${this.button(5)}  ${selection?'Skin':'Scroll'}`;
  if(this.bar.textContent!==text)this.bar.textContent=text;
  document.querySelectorAll<HTMLOptionElement>('[data-pad] option').forEach(el=>{const label=this.active?this.button(Number(el.value)):`Button ${el.value}`;if(el.textContent!==label)el.textContent=label;});
  document.querySelectorAll<HTMLElement>('[data-prompt-pause]').forEach(el=>{el.textContent=this.active?this.button(9):'ESC';});
 }
 dispose(){this.abort.abort();this.bar.remove();}
}
