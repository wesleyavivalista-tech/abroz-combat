import {desktopBridge} from './platform/runtime.js';
// Covers module/renderer initialization failures before main.ts can install its normal error UI.
void import('./main.js').catch(()=>{
 desktopBridge()?.reportFailure('initialization');
 const root=document.getElementById('ui')??document.body;root.replaceChildren();
 const panel=document.createElement('section');panel.style.cssText='margin:8vh auto;padding:32px;max-width:650px;background:#111b24;color:#fff;font:20px/1.5 sans-serif';
 const title=document.createElement('h1');title.textContent='Unable to start Abroz Combat';
 const message=document.createElement('p');message.textContent='The game could not initialize its graphics or load required files. Restart the game, check your graphics driver, or reinstall the application if this continues.';
 const retry=document.createElement('button');retry.textContent='RETRY';retry.onclick=()=>location.reload();panel.append(title,message,retry);root.append(panel);retry.focus();
});
