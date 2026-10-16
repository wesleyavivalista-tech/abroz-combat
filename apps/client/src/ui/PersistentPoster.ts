import type {PersistentTournament,PersistentLobby} from '../../../../packages/shared/persistentChampionship.js';
/** Render a shareable poster from the authoritative tournament snapshot. */
export async function persistentPoster(t:PersistentTournament,lobbies:PersistentLobby[],link:string):Promise<Blob>{
 await document.fonts.ready;
 const columns=3,rows=Math.ceil(t.series.length/columns),c=document.createElement('canvas');
 c.width=1920;c.height=1080+Math.max(0,rows-1)*230;
 const x=c.getContext('2d')!,champion=t.competitors.find(v=>v.id===t.champion);
 const load=(src:string)=>new Promise<HTMLImageElement|undefined>(resolve=>{const im=new Image();const timer=setTimeout(()=>resolve(undefined),5000);im.onload=()=>{clearTimeout(timer);resolve(im);};im.onerror=()=>{clearTimeout(timer);resolve(undefined);};im.src=src;});
 const [arena,logo]=await Promise.all([load('/art/modes/championship-poster-arena-v1.png'),load('/art/abroz-combat-wordmark-v2.svg')]);
 x.fillStyle='#051321';x.fillRect(0,0,c.width,c.height);
 // Keep the trophy at its designed size even when larger brackets extend the poster.
 if(arena){const scale=c.width/arena.width;x.drawImage(arena,0,0,c.width,arena.height*scale);}
 if(logo){x.save();x.globalAlpha=.94;x.drawImage(logo,875,210,170,170*logo.height/logo.width);x.restore();}
 const shade=x.createLinearGradient(0,380,0,1080);shade.addColorStop(0,'#00102000');shade.addColorStop(.45,'#00101b44');shade.addColorStop(1,rows>1?'#051321':'#020b1422');x.fillStyle=shade;x.fillRect(0,380,c.width,c.height-380);
 const text=(s:string,px:number,py:number,size:number,color:string|CanvasGradient='#eaf3f8',max=1800,italic=false)=>{x.font=`${italic?'italic ':''}900 ${size}px Arial, sans-serif`;while(x.measureText(s).width>max&&size>12){size--;x.font=`${italic?'italic ':''}900 ${size}px Arial, sans-serif`;}x.fillStyle=color;x.fillText(s,px,py);};
 const center=(s:string,y:number,size:number,color:string|CanvasGradient,max=1800,italic=false)=>{x.save();x.textAlign='center';text(s,960,y,size,color,max,italic);x.restore();};
 const line=(y:number,left=70,right=1850)=>{const g=x.createLinearGradient(left,0,right,0);g.addColorStop(0,'#c9953400');g.addColorStop(.2,'#fbd783');g.addColorStop(.8,'#fbd783');g.addColorStop(1,'#c9953400');x.fillStyle=g;x.fillRect(left,y,right-left,2);};
 center('ABROZ COMBAT  /  '+(champion?'HALL OF CHAMPIONS':'OPEN CHAMPIONSHIP'),48,27,'#eec77d');
 const words=t.name.trim().split(/\s+/),first=words.shift()??'',rest=words.length?' '+words.join(' '):'';
 let titleSize=128;x.font=`900 ${titleSize}px Arial, sans-serif`;
 while(x.measureText(t.name).width>1760&&titleSize>30){titleSize--;x.font=`900 ${titleSize}px Arial, sans-serif`;}
 const start=(1920-x.measureText(first+rest).width)/2,firstWidth=x.measureText(first).width;
 x.save();x.shadowColor='#000';x.shadowBlur=8;x.shadowOffsetY=3;
 text(first,start,535,titleSize,'#ffffff',1760);text(rest,start+firstWidth,535,titleSize,'#ffffff',1760);x.restore();
 center(champion?'CHAMPIONS · '+champion.name:'THE NEXT FIGHT IS YOURS',608,38,'#f6d78a',1760);
 center(`${t.mode}  /  BEST OF 3  /  ${t.series.filter(s=>s.status==='completed').length} OF ${t.series.length} SERIES COMPLETE`,657,25,'#8fcdf5');
 const name=(id:number|null)=>id===null?'To be decided':t.competitors.find(v=>v.id===id)?.name??'To be decided';
 const panel=(px:number,py:number,w:number,h:number)=>{x.beginPath();x.moveTo(px+20,py);x.lineTo(px+w,py);x.lineTo(px+w,py+h-20);x.lineTo(px+w-20,py+h);x.lineTo(px,py+h);x.lineTo(px,py+20);x.closePath();const fill=x.createLinearGradient(0,py,0,py+h);fill.addColorStop(0,'#132d40f2');fill.addColorStop(.3,'#04101ef5');fill.addColorStop(1,'#102234f5');x.fillStyle=fill;x.fill();x.strokeStyle='#ccaf6b';x.lineWidth=2;x.stroke();x.fillStyle='#e9c979';x.beginPath();x.moveTo(px,py+24);x.lineTo(px,py);x.lineTo(px+24,py);x.fill();};
 t.series.forEach((s,i)=>{const px=70+(i%columns)*600,py=690+Math.floor(i/columns)*230,w=580,l=lobbies.find(v=>v.seriesId===s.id);panel(px,py,w,208);const round=['FINAL','SEMIFINAL','QUARTERFINAL','ROUND OF 16'][Math.log2(t.competitors.length)-1-s.round]??'ROUND';const state=s.status==='completed'?'COMPLETED':l?.attempt?'IN PROGRESS':s.status==='waiting'?'UPCOMING':l?.slots.some(v=>v.occupied)?'LOBBY · JOIN':'AVAILABLE · JOIN';text(`${round} · ${state}`,px+28,py+36,24,'#b5d6eb',w-56);
  s.sides.forEach((id,j)=>{const y=py+60+j*66;x.fillStyle='#020c16bb';x.fillRect(px+117,y,w-142,59);x.strokeStyle='#284457';x.strokeRect(px+117,y,w-142,59);const score=x.createLinearGradient(0,y,0,y+59);score.addColorStop(0,'#193b58');score.addColorStop(1,'#061729');x.fillStyle=score;x.fillRect(px+25,y,84,59);x.strokeStyle='#5482a0';x.lineWidth=1;x.strokeRect(px+25,y,84,59);text(String(s.score[j]),px+54,y+43,40,'#a9d9ff',60);text(name(id),px+130,y+42,36,s.winner===id&&id!==null?'#ffe3a0':'#eaf3f8',w-156);});
 });
 const footer=690+rows*230;panel(390,footer+7,1140,66);line(footer+8,390,1530);center(champion?'CHAMPIONS CROWNED · THE LEGACY CONTINUES':'NO ACCOUNTS · PICK A FIGHTER · READY UP',footer+51,33,'#f7d682');line(footer+70,390,1530);
 center(link,footer+109,21,'#aecbdf',1760);center('TOURNAMENT ID: '+t.id,footer+143,18,'#7998b0');
 return new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('PNG export failed')),'image/png'));
}
