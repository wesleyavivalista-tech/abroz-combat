import {mappedButtonBinding,type MappingProfile} from './ControllerMapping.js';
import {t} from '../i18n/index.js';
import {controllerButtonName,type ControllerDevice} from './GamepadManager.js';
export class ControllerHints {
 private profile?:MappingProfile;
 active=false;brand:ControllerDevice['brand']='generic';
 private abort=new AbortController();private bar=document.createElement('div');
 constructor(){
  this.bar.className='controller-hints';this.bar.hidden=true;document.body.append(this.bar);
  for(const event of ['pointerdown','keydown'])document.addEventListener(event,()=>{this.active=false;document.documentElement.dataset.inputDevice='keyboard';this.bar.hidden=true;},{signal:this.abort.signal});
 }
 use(brand:ControllerDevice['brand'],profile?:MappingProfile){this.profile=profile;this.active=true;this.brand=brand;document.documentElement.dataset.inputDevice='controller';}
 button(index:number){const b=this.profile&&mappedButtonBinding(this.profile,index);return b?b.kind==='button'?controllerButtonName(b.index,'generic'):`${t('controller.axis',{axis:b.index})} ${b.peak>b.rest?'+':'−'}`:controllerButtonName(index,this.brand);}
 update(gameplay:boolean,selection:boolean,override?:string){
  const dialogs=document.querySelectorAll('dialog[open]');const parent=dialogs[dialogs.length-1]??document.body;
  if(this.bar.parentElement!==parent)parent.append(this.bar);
  this.bar.hidden=!this.active;
  const current=document.activeElement;
  const adjust=current instanceof HTMLSelectElement||current instanceof HTMLInputElement&&['range','number'].includes(current.type);
  const text=override??(gameplay?`${this.button(9)}  ${t('hints.pause')}`:`${t('hints.navigate')}   ${adjust?t('hints.adjust'):''}${this.button(0)}  ${current instanceof HTMLInputElement&&current.type==='text'?t('hints.enter'):t('hints.confirm')}   ${this.button(1)}  ${t('hints.back')}   ${this.button(4)} / ${this.button(5)}  ${selection?t('hints.skin'):t('hints.scroll')}`);
  if(this.bar.textContent!==text)this.bar.textContent=text;
  document.querySelectorAll<HTMLOptionElement>('[data-pad] option').forEach(el=>{const label=this.active?this.button(Number(el.value)):t('settings.button',{button:el.value});if(el.textContent!==label)el.textContent=label;});
  document.querySelectorAll<HTMLElement>('[data-prompt-pause]').forEach(el=>{el.textContent=this.active?this.button(9):'ESC';});
 }
 dispose(){this.abort.abort();this.bar.remove();}
}
