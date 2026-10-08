import * as THREE from 'three';
export interface VisualLightRequest {id:string;x:number;y:number;radius:number;intensity:number;color:string;duration:number;priority?:number}
interface Slot {id:string;x:number;y:number;radius:number;intensity:number;color:THREE.Color;life:number;duration:number;priority:number}
/** Fixed capacity; all positions are game coordinates. No gameplay mutations. */
export class VisualLightPool {
 readonly slots:Slot[]=Array.from({length:32},()=>({id:'',x:0,y:0,radius:1,intensity:0,color:new THREE.Color(),life:0,duration:1,priority:0}));
 private seen=new Set<string>();private history:string[]=[];
 readonly positions=Array.from({length:8},()=>new THREE.Vector4());
 readonly colors=Array.from({length:8},()=>new THREE.Vector3());
 count=0;
 spawn(r:VisualLightRequest,continuous=false):void{
  if(!Number.isFinite(r.x+r.y+r.radius+r.intensity+r.duration)||r.radius<=0||r.duration<=0)return;
  let slot=continuous?this.slots.find(s=>s.id===r.id&&s.life>0):undefined;
  if(!continuous){if(this.seen.has(r.id))return;this.seen.add(r.id);this.history.push(r.id);if(this.history.length>256)this.seen.delete(this.history.shift()!);}
  slot??=this.slots.find(s=>s.life<=0);
  if(!slot){slot=this.slots.reduce((a,b)=>a.priority*a.intensity*a.life/a.duration<b.priority*b.intensity*b.life/b.duration?a:b);if(slot.priority*slot.intensity>(r.priority??1)*r.intensity)return;}
  Object.assign(slot,{id:r.id,x:r.x,y:r.y,radius:Math.min(900,r.radius),intensity:Math.min(.65,Math.max(0,r.intensity)),life:Math.min(2,r.duration),duration:Math.min(2,r.duration),priority:r.priority??1});slot.color.set(r.color);
 }
 update(dt:number,budget:number,cameraX:number,stageWidth:number,multiplier:number):void{
  for(const s of this.slots)s.life=Math.max(0,s.life-Math.min(.1,Math.max(0,dt)));
  // Sort at most 32 pooled references; no light objects or GPU shadow maps are created.
  const active=this.slots.filter(s=>s.life>0).sort((a,b)=>this.score(b,cameraX)-this.score(a,cameraX));
  this.count=Math.min(Math.max(0,budget),8,active.length);
  for(let i=0;i<8;i++){
   const s=active[i];if(i>=this.count){this.positions[i].set(0,0,0,0);this.colors[i].set(0,0,0);continue;}
   this.positions[i].set(s.x/100-stageWidth/200,s.y/100,s.radius/100,s.intensity*s.life/s.duration*multiplier);
   this.colors[i].set(s.color.r,s.color.g,s.color.b);
  }
 }
 private score(s:Slot,cameraX:number){return s.priority*s.intensity*s.life/s.duration/(1+Math.abs(s.x-cameraX)/1000);}
 clear():void{this.slots.forEach(s=>s.life=0);this.seen.clear();this.history=[];this.count=0;this.positions.forEach(p=>p.set(0,0,0,0));}
}
