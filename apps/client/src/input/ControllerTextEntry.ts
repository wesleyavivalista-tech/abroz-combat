import {t} from '../i18n/index.js';
/** Controller-operated text/key entry; native typing remains available in the original field. */
export function controllerTextEntry(field:HTMLInputElement|HTMLElement,commit:(value:string)=>void,binding=false):void {
 if(document.getElementById('controller-text-entry'))return;
 const dialog=document.createElement('dialog');dialog.id='controller-text-entry';dialog.className='controller-dialog controller-text-entry';
 const title=document.createElement('h2');title.textContent=binding?t('entry.key'):field.getAttribute('aria-label')??t('entry.text');
 const preview=document.createElement('output');preview.setAttribute('aria-live','polite');
 let value=field instanceof HTMLInputElement?field.value:'';
 const limit=field instanceof HTMLInputElement&&field.maxLength>0?field.maxLength:64;
 const keys=document.createElement('div');keys.className='controller-keyboard';
 const choices=binding?[...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].filter(c=>c!=='R').map(c=>`Key${c}`).concat([...'0123456789'].map(c=>`Digit${c}`),['Space','Enter','ShiftLeft','ControlLeft','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']):[...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 'Space','⌫','Clear'];
 const close=()=>{dialog.close();dialog.remove();if(field.isConnected)field.focus();};
 for(const key of choices){const b=document.createElement('button');b.type='button';b.textContent=!binding&&key==='Space'?t('entry.space'):!binding&&key==='Clear'?t('entry.clear'):key;b.dataset.key=key;
  b.onclick=()=>{if(binding){commit(key);close();return;}value=key==='Clear'?'':key==='⌫'?value.slice(0,-1):value.length<limit?value+(key==='Space'?' ':key):value;preview.textContent=value||'—';};keys.append(b);}
 const actions=document.createElement('div');actions.className='controller-entry-actions';
 for(const label of binding?['Cancel']:['Done','Cancel']){const b=document.createElement('button');b.textContent=t(label==='Done'?'entry.done':'entry.cancel');b.onclick=()=>{if(label==='Done')commit(value);close();};actions.append(b);}
 preview.textContent=value||'—';dialog.append(title,preview,keys,actions);document.querySelector('#ui')!.append(dialog);dialog.showModal();
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});keys.querySelector('button')?.focus();
}
