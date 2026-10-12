import {storage} from '../platform/storage.js';
export type Binding={kind:'button';index:number}|{kind:'axis'|'hat';index:number;rest:number;peak:number};
export interface MappingProfile {buttons:number;axes:number;bindings:Binding[];}
export const mappingSteps=['left','right','up','down','jump','basic1','basic2','basic3','special1','special2','ultimate1','ultimate2','pause','dpadLeft','dpadRight','dpadUp','dpadDown'] as const;
const targets=[-1,-1,-1,-1,0,2,3,1,5,7,4,6,9,14,15,12,13];
export function mappedButtonBinding(profile:MappingProfile,index:number){const step=targets.indexOf(index);return step>=0?profile.bindings[step]:undefined;}
const storageKey='abroz-controller-mappings-v1';
export function mappingKey(id:string,buttons:number,axes:number){return JSON.stringify([id,buttons,axes]);}
export function bindingValue(binding:Binding,buttons:readonly number[],axes:readonly number[]):number{
 if(binding.kind==='button')return Math.max(0,Math.min(1,buttons[binding.index]??0));
 const value=axes[binding.index]??binding.rest;
 if(!Number.isFinite(value))return 0;
 return binding.kind==='hat'?Number(Math.abs(value-binding.peak)<.08):Math.max(0,Math.min(1,(value-binding.rest)/(binding.peak-binding.rest)));
}
export function validProfile(value:unknown):value is MappingProfile{
 if(!value||typeof value!=='object')return false;
 const p=value as MappingProfile;
 return Number.isInteger(p.buttons)&&p.buttons>=0&&p.buttons<=256&&Number.isInteger(p.axes)&&p.axes>=0&&p.axes<=64&&Array.isArray(p.bindings)&&[13,17].includes(p.bindings.length)&&p.bindings.every(b=>
  b&&Number.isInteger(b.index)&&b.index>=0&&(b.kind==='button'?b.index<p.buttons:(b.kind==='axis'||b.kind==='hat')&&b.index<p.axes&&Number.isFinite(b.rest)&&Number.isFinite(b.peak)&&Math.abs(b.rest)<=4&&Math.abs(b.peak)<=4&&Math.abs(b.peak-b.rest)>=(b.kind==='hat'?.1:.5)));
}
export function mappedInput(profile:MappingProfile,rawButtons:readonly number[],rawAxes:readonly number[]){
 const values=profile.bindings.map(b=>bindingValue(b,rawButtons,rawAxes));
 const buttons=Array<number>(17).fill(0);
 for(let i=4;i<values.length;i++)buttons[targets[i]]=values[i];
 return {buttons,axes:[values[1]-values[0],values[3]-values[2]]};
}
/** Profiles describe a model/layout, never a player or a browser device index. */
export class ControllerMappings {
 readonly profiles=new Map<string,MappingProfile>();
 wizard:{device:number;key:string;step:number;rest:number[];buttons:number;bindings:Binding[];phase:'ready'|'input'|'release'|'complete';error:boolean}|null=null;
 constructor(){try{const saved:unknown=JSON.parse(storage.getItem(storageKey)??'[]');if(Array.isArray(saved))for(const pair of saved.slice(-32))if(Array.isArray(pair)&&typeof pair[0]==='string'&&pair[0].length<2048&&validProfile(pair[1]))this.profiles.set(pair[0],pair[1]);}catch{/* Optional local preferences. */}}
 begin(device:number,key:string){this.wizard={device,key,step:0,rest:[],buttons:0,bindings:[],phase:'ready',error:false};}
 start(buttons:readonly number[],axes:readonly number[]){
 const w=this.wizard;if(!w||w.phase!=='ready'||buttons.some(v=>v>.5)||!axes.every(Number.isFinite))return false;
 w.rest=[...axes];w.buttons=buttons.length;w.phase='input';return true;
 }
 skipDpad(){const w=this.wizard;if(w&&w.step===13&&w.phase==='input')w.phase='complete';}
 sample(buttons:readonly number[],axes:readonly number[]){
 const w=this.wizard;if(!w||w.phase==='ready'||w.phase==='complete')return;
 if(buttons.length!==w.buttons||axes.length!==w.rest.length){this.wizard=null;return;}
 const neutral=!buttons.some(v=>v>.35)&&axes.every((v,i)=>Math.abs(v-w.rest[i])<.2);
 if(w.phase==='release'){if(neutral){w.phase=w.step===mappingSteps.length?'complete':'input';}return;}
 const pressed=buttons.map((v,index)=>({v,index})).filter(b=>b.v>.65);
 const moved=axes.map((v,index)=>({v:Math.abs(v-w.rest[index]),index})).filter(a=>a.v>(Math.abs(w.rest[a.index])>1?.1:.65)).sort((a,b)=>b.v-a.v);
 let binding:Binding|undefined;
 if(pressed.length===1)binding={kind:'button',index:pressed[0].index};
 else if(!pressed.length&&moved.length&&(!moved[1]||moved[0].v>moved[1].v*1.4)){
 const index=moved[0].index;binding={kind:Math.abs(w.rest[index])>1?'hat':'axis',index,rest:w.rest[index],peak:Math.abs(w.rest[index])>1?axes[index]:axes[index]>w.rest[index]?1:-1};
 }
 if(!binding)return;
 const candidate=binding;
 if(w.bindings.some(b=>b.kind===candidate.kind&&b.index===candidate.index&&(b.kind==='button'||candidate.kind!=='button'&&Math.abs(b.peak-candidate.peak)<.4))){w.error=true;return;}
 w.bindings.push(binding);w.step++;w.error=false;w.phase='release';
 }
 save():boolean{
 const w=this.wizard;if(!w||w.phase!=='complete')return false;
 const p={buttons:w.buttons,axes:w.rest.length,bindings:w.bindings};if(!validProfile(p))return false;
 this.profiles.delete(w.key);this.profiles.set(w.key,p);
 while(this.profiles.size>32)this.profiles.delete(this.profiles.keys().next().value!);
 try{storage.setItem(storageKey,JSON.stringify([...this.profiles]));}catch{/* Still usable for this session. */}
 this.wizard=null;return true;
 }
}
