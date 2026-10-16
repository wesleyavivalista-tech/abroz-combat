import type {PersistentCommand,PersistentEvent,PersistentCreate,PersistentCard,PersistentLobby,PersistentTournament,PersistentMode} from '../../../packages/shared/persistentChampionship.js';
import {initialPersistentConfig,randomizePersistentBracket,persistentBracketPreview,persistentBrowser,persistentCreate,persistentDetail,pcButton} from './ui/PersistentChampionship.js';
import {persistentPoster} from './ui/PersistentPoster.js';
import {onlineText as l} from './ui/OnlineLobby.js';
export class PersistentController {
 page:'browse'|'create'|'detail'='browse';completed=false;offset=0;more=false;cards:PersistentCard[]=[];
 tournament?:PersistentTournament;lobbies:PersistentLobby[]=[];selected:string|null=null;tab='bracket';pin='';notice='';manage=false;config:PersistentCreate=initialPersistentConfig();
 private posterPending=false;private busy=false;private session:string;
 constructor(private send:(m:PersistentCommand)=>Promise<void>,private redraw:()=>void){try{this.session=localStorage.getItem('abroz-persistent-session')??crypto.randomUUID();localStorage.setItem('abroz-persistent-session',this.session);}catch{this.session=crypto.randomUUID();}}
 markup(){return this.page==='create'?persistentCreate(this.config):this.page==='detail'&&this.tournament?persistentDetail(this.tournament,this.lobbies,this.selected,this.tab,this.pin,this.notice,this.manage):persistentBrowser(this.cards,this.completed,this.offset,this.more);}
 async browse(){this.page='browse';this.pin='';await this.send({type:'persistent',action:'list',completed:this.completed,offset:this.offset});}
 async open(id:string){this.page='detail';this.notice='';await this.send({type:'persistent',action:'open',id});}
 failed(){this.busy=false;this.posterPending=false;}
 receive(m:PersistentEvent){
  if(m.type==='persistent-list'){this.cards=m.cards;this.more=m.hasMore;}
  if(m.type==='persistent-created'){this.busy=false;this.tournament=m.tournament;this.pin=m.pin;this.page='detail';void this.send({type:'persistent',action:'open',id:m.tournament.id});}
  if(m.type==='persistent-detail'){this.tournament=m.tournament;this.lobbies=m.lobbies;if(this.posterPending){this.posterPending=false;void this.poster();}}
  if(m.type==='persistent-deleted'){this.tournament=undefined;this.lobbies=[];void this.browse();}
  if(m.type==='persistent-ended'){this.notice=m.message;this.selected=m.seriesId;this.page='detail';}
  this.redraw();
 }
 refresh(){if(this.page==='browse')void this.send({type:'persistent',action:'list',completed:this.completed,offset:this.offset});else if(this.page==='detail'&&this.tournament)void this.send({type:'persistent',action:'open',id:this.tournament.id});}
 change(el:HTMLInputElement|HTMLSelectElement){
  if(this.page!=='create')return;
  if(el.id==='pc-name')this.config.name=el.value;
  if(el.id==='pc-stage')this.config.stage=el.value;
  if(el.id==='pc-mode'||el.id==='pc-count'){this.config={...initialPersistentConfig(el.id==='pc-mode'?el.value as PersistentMode:this.config.mode,el.id==='pc-count'?Number(el.value):this.config.competitors.length),name:this.config.name,stage:this.config.stage};}
  if(el.dataset.pcTeam!==undefined)this.config.competitors[Number(el.dataset.pcTeam)].name=el.value;
  if(el.dataset.pcFighter){const [i,j]=el.dataset.pcFighter.split(',').map(Number);this.config.competitors[i].fighters[j]=el.value;this.config.competitors[i].skins![j]='original';}
  if(el.dataset.pcSkin){const [i,j]=el.dataset.pcSkin.split(',').map(Number);this.config.competitors[i].skins![j]=el.value;}
  if(el instanceof HTMLSelectElement)this.redraw();
  else {const preview=document.getElementById('pc-preview-matches');if(preview)preview.innerHTML=persistentBracketPreview(this.config);}
 }
 async action(el:HTMLElement){
  const action=el.dataset.pc,id=this.tournament?.id;
  if(action==='create'){this.config=initialPersistentConfig();this.page='create';this.redraw();}
  if(action==='active'||action==='history'){this.completed=action==='history';this.offset=0;await this.browse();}
  if(action==='refresh')this.refresh();
  if(action==='next'||action==='previous'){this.offset=Math.max(0,this.offset+(action==='next'?24:-24));await this.browse();}
  if(action==='open')await this.open(el.dataset.id!);
  if(action==='shuffle'&&this.page==='create'&&!this.busy){this.config=randomizePersistentBracket(this.config);this.redraw();document.querySelector<HTMLButtonElement>('[data-pc=shuffle]')?.focus();}
  if(action==='save'){if(this.busy)return;this.busy=true;try{await this.send({type:'persistent',action:'create',config:this.config});}catch(e){this.busy=false;throw e;}}
  if(action==='series'){this.selected=el.dataset.id!;this.redraw();document.querySelector<HTMLButtonElement>('.pc-series-panel [data-pc=claim]:not(:disabled),.pc-series-panel [data-pc=ready]')?.focus();}
  if(action==='bracket'||action==='stats'){this.tab=action;this.redraw();}
  if(action==='pin-saved'){this.pin='';this.redraw();}
  if(action==='manage'){this.manage=!this.manage;this.redraw();}
  if(action==='delete'&&id){const pin=(document.getElementById('pc-pin') as HTMLInputElement).value;const d=document.createElement('dialog');d.className='controller-dialog';d.id='persistent-dialog';d.innerHTML=`<h2>${l('Delete this championship?','Excluir este campeonato?')}</h2><p>${l('Its unfinished bracket and saved fights will be permanently removed.','A chave e as lutas salvas serão removidas permanentemente.')}</p>${pcButton('cancel-delete',l('Cancel','Cancelar'))}${pcButton('confirm-delete',l('Delete championship','Excluir campeonato'))}`;document.getElementById('ui')!.append(d);d.showModal();d.querySelector('button')!.focus();d.onclick=e=>{const a=(e.target as HTMLElement).closest<HTMLElement>('[data-pc]')?.dataset.pc;if(a==='confirm-delete')void this.send({type:'persistent',action:'delete',id,pin});if(a==='confirm-delete'||a==='cancel-delete'){d.close();d.remove();}};d.oncancel=()=>d.remove();}
  if(action==='claim'&&id)await this.send({type:'persistent',action:'claim',id,seriesId:el.dataset.id!,slot:Number(el.dataset.slot),session:this.session});
  if(action==='ready'){const own=this.lobbies.find(l=>l.seat>=0);if(own)await this.send({type:'persistent',action:'ready',ready:!own.slots[own.seat].ready});}
  if(action==='leave-slot'&&id){await this.send({type:'persistent',action:'leave'});await this.open(id);}
  if(action==='link'&&id){try{await navigator.clipboard.writeText(this.link());this.notice=l('Championship link copied.','Link copiado.');}catch{this.notice=this.link();}this.redraw();}
  if(action==='advertise'&&id&&!this.posterPending){this.posterPending=true;this.notice=l('Preparing current championship poster…','Preparando pôster atualizado…');this.redraw();await this.send({type:'persistent',action:'open',id});}
 }
 link(){const url=new URL('/play',location.protocol==='abroz:'?'https://abrozcombat.com':location.origin);url.searchParams.set('championship',this.tournament!.id);return url.href;}
 private async poster(){try{const blob=await persistentPoster(this.tournament!,this.lobbies,this.link());const url=URL.createObjectURL(blob),d=document.createElement('dialog');d.className='controller-dialog';d.id='persistent-dialog';d.style.maxWidth='700px';d.innerHTML=`<h2>${l('Championship poster','Pôster do campeonato')}</h2><img src="${url}" alt="Championship poster" style="width:100%;max-height:60vh;object-fit:contain"><div class="pc-actions"><a class="button" href="${url}" download="abroz-championship.png">${l('Download PNG','Baixar PNG')}</a>${pcButton('share-poster',l('Share','Compartilhar'))}${pcButton('close-poster',l('Close','Fechar'))}</div><p role="status"></p>`;document.getElementById('ui')!.append(d);d.showModal();d.querySelector('a')!.focus();const close=()=>{d.close();d.remove();URL.revokeObjectURL(url);this.redraw();};d.oncancel=e=>{e.preventDefault();close();};d.onclick=async e=>{const a=(e.target as HTMLElement).closest<HTMLElement>('[data-pc]')?.dataset.pc;if(a==='close-poster')close();if(a==='share-poster'){try{const file=new File([blob],'abroz-championship.png',{type:'image/png'});if(navigator.canShare?.({files:[file]}))await navigator.share({files:[file],title:this.tournament!.name});else d.querySelector('p')!.textContent=l('Use Download PNG, then share it in your chat.','Use Baixar PNG e compartilhe no seu chat.');}catch{d.querySelector('p')!.textContent=l('Sharing cancelled. Download remains available.','Compartilhamento cancelado. O download está disponível.');}}};this.notice='';}catch{this.notice=l('Could not export this poster. Please try again.','Não foi possível exportar. Tente novamente.');this.redraw();}}
}
