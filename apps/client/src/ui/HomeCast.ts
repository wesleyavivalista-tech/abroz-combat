import {characters} from '../../../../packages/game-core/characters/registry.js';
import {fighterPresentation} from './FighterPresentation.js';
const openingCast=['bozo','drupa','tocha','gut','dodo','caio','nikalz','jopa','roms','luizinho','napa','jomp','astolfo','fausto','biel','eide'];
export function homeCastTick(now:number,startedAt:number):number{return Math.max(0,Math.floor((now-startedAt)/15000));}
export function homeCastPair(step:number):readonly [string,string]{
 const roster=[...openingCast.filter(id=>characters[id]),...Object.keys(characters).filter(id=>!openingCast.includes(id))];
 const count=Math.ceil(roster.length/2),pair=((step%count)+count)%count;
 return [roster[pair*2],roster[(pair*2+1)%roster.length]];
}
const revisions = new WeakMap<HTMLElement, number>();
/** Decode the replacement before crossfading; never change a visible image's framing. */
export function updateHomeCast(root:HTMLElement,step:number):void{
 const revision=(revisions.get(root)??0)+1;
 revisions.set(root,revision);
 homeCastPair(step).forEach((id,index)=>{ void swapPortrait(root,id,index,revision); });
}
async function swapPortrait(root:HTMLElement,id:string,index:number,revision:number):Promise<void>{
 const side=index===0?'left':'right',p=fighterPresentation(id);
 const old=root.querySelector<HTMLImageElement>(`.ac-home-cast .cast-${side}:not(.cast-outgoing):not(.cast-incoming)`);
 if(!old||old.dataset.fighter===id)return;
 const next=old.cloneNode(false) as HTMLImageElement;
 next.src=p.portrait;next.dataset.fighter=id;
 next.style.scale=String(p.homeScale??p.previewScale??1);next.style.transformOrigin='50% 0';
 next.style.transform=`scaleX(${(index===0)===(p.facing==='right')?1:-1})`;
 next.classList.add('cast-incoming');next.style.opacity='0';
 old.parentElement!.append(next);
 const current=()=>old.isConnected&&revisions.get(root)===revision;
 try{
  // CSS silhouette masks must be ready too, otherwise an opaque backdrop flashes.
  const mask=getComputedStyle(next).maskImage;
  const masks=Array.from(mask.matchAll(/url\(["']?([^"')]+)["']?\)/g),match=>{
   const image=new Image();image.src=match[1];return image.decode();
  });
  await Promise.all([next.decode(),...masks]);
 }catch{next.remove();return;}
 if(!current()){next.remove();return;}
 next.classList.remove('cast-incoming');old.classList.add('cast-outgoing');
 next.style.removeProperty('opacity');
 const opacity=getComputedStyle(next).opacity;
 const duration=matchMedia('(prefers-reduced-motion: reduce)').matches?0:450;
 const outgoing=old.animate([{opacity:getComputedStyle(old).opacity},{opacity:0}],{duration,fill:'forwards',easing:'ease-in-out'});
 const incoming=next.animate([{opacity:0},{opacity}],{duration,easing:'ease-in-out'});

 await Promise.allSettled([outgoing.finished,incoming.finished]);
 old.remove();outgoing.cancel();incoming.cancel();
}
