/// <reference types="vite/client" />
import {updateMarkup} from '../ui/UI.js';
const button=document.querySelector<HTMLButtonElement>('#run')!;
button.disabled=!import.meta.env.DEV;
button.onclick=()=>{
 const host=document.querySelector('#fixture')!,reports=[];
 for(const guarded of [false,true]){
  host.innerHTML=Array.from({length:16},()=>'<div></div>').join('');
  const cells=[...host.children];const observer=new MutationObserver(()=>{});observer.observe(host,{childList:true,subtree:true});
  const times:number[]=[];
  for(let batch=0;batch<10;batch++){
   const start=performance.now();
   for(let frame=0;frame<100;frame++)for(let i=0;i<16;i++){
    const value=i%2?`<i class="remaining"></i><i class="remaining"></i><i class="${batch%2?'':'remaining'}"></i><span>${batch%2?2:3} LIVES</span>`:`<span class="super-slot ready"><b>O</b> ULTIMATE 1 <em>READY</em></span><span class="super-slot"><b>P</b> ULTIMATE 2 <em>CHARGE</em></span>`;
    if(guarded)updateMarkup(cells[i],value);else cells[i].innerHTML=value;
   }
   times.push(performance.now()-start);
  }
  const mutations=observer.takeRecords().length;observer.disconnect();
  reports.push({guarded,updates:16000,childListMutations:mutations,totalMs:times.reduce((a,b)=>a+b,0),batchMs:times});
 }
 document.querySelector('#status')!.textContent='Completed';document.querySelector('#results')!.textContent=JSON.stringify(reports,null,2);
};
export {};
