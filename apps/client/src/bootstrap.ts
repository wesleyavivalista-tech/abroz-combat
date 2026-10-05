import {desktopBridge} from './platform/runtime.js';
// Covers module/renderer initialization failures before main.ts can install its normal error UI.
void import('./main.js').catch((error: unknown)=>{
 // Keep the actual cause available while developing instead of hiding import failures.
 if ((import.meta as ImportMeta & {env?: {DEV?: boolean}}).env?.DEV) console.error('Game initialization failed:', error);
 desktopBridge()?.reportFailure('initialization');
 const root=document.getElementById('ui')??document.body;root.replaceChildren();
 const panel=document.createElement('section');panel.style.cssText='margin:8vh auto;padding:32px;max-width:650px;background:#111b24;color:#fff;font:20px/1.5 sans-serif';
 const title=document.createElement('h1');title.textContent='Unable to start Abroz Combat';
 const message=document.createElement('p');message.textContent=desktopBridge()
  ? 'The game could not finish loading. Restart the application. If this continues, check the application logs before reinstalling.'
  : ['localhost','127.0.0.1','[::1]'].includes(location.hostname)
   ? 'The game could not finish loading. Make sure the local game server is running, then retry. If this continues, check the browser console for the startup error.'
   : 'The game could not finish loading. Check your connection and retry. If this continues, report the problem.';
 const retry=document.createElement('button');retry.textContent='RETRY';retry.onclick=()=>location.reload();panel.append(title,message,retry);root.append(panel);retry.focus();
});
