import {astolfoSpiderFrames} from './AstolfoRenderer.js';
import * as THREE from 'three';
import type {SimulationSnapshot} from '../../../../packages/game-core/types.js';
import {isTalking,ASTOLFO} from '../../../../packages/game-core/simulation/AstolfoSystem.js';
import {isActive} from '../../../../packages/game-core/simulation/LifeSystem.js';
import {worldX} from './StageCoordinates.js';

function bubbleTexture(text:string){
 const c=document.createElement('canvas');c.width=256;c.height=128;const x=c.getContext('2d')!;
 x.fillStyle='#eefaff';x.strokeStyle='#304d65';x.lineWidth=7;x.beginPath();x.roundRect(9,8,236,93,24);x.fill();x.stroke();
 x.beginPath();x.moveTo(48,99);x.lineTo(36,123);x.lineTo(83,99);x.fill();x.stroke();
 x.fillStyle='#263b50';x.font='bold 40px system-ui';x.textAlign='center';x.textBaseline='middle';x.fillText(text,128,57);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
/** Reusable effect pools, driven only by current snapshot state. */
export class AstolfoEffects{
 root=new THREE.Group();private bubbles:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>[]=[];
 private rings:THREE.Mesh<THREE.RingGeometry,THREE.MeshBasicMaterial>[]=[];
 private waves:THREE.Mesh<THREE.RingGeometry,THREE.MeshBasicMaterial>[]=[];
 private spiders:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>[]=[];private textures=['BLA','...','IDEA!'].map(bubbleTexture);
 private bubble(index:number){
  if(!this.bubbles[index]){const m=new THREE.Mesh(new THREE.PlaneGeometry(1,.5),new THREE.MeshBasicMaterial({map:this.textures[index%2],transparent:true,depthWrite:false,toneMapped:false}));this.bubbles.push(m);this.root.add(m);}return this.bubbles[index];
 }
 private ring(index:number){
  if(!this.rings[index]){const m=new THREE.Mesh(new THREE.RingGeometry(.93,1,48),new THREE.MeshBasicMaterial({color:0x9dd8f5,transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));this.rings.push(m);this.root.add(m);}return this.rings[index];
 }
 private wave(index:number){
  if(!this.waves[index]){const m=new THREE.Mesh(new THREE.RingGeometry(.93,1,24,1,-.85,1.7),new THREE.MeshBasicMaterial({color:0xb6e5ff,transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));this.waves.push(m);this.root.add(m);}return this.waves[index];
 }
 private spider(index:number){
  if(!this.spiders[index]){const m=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({transparent:true,alphaTest:.1,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));this.spiders.push(m);this.root.add(m);}return this.spiders[index];
 }
 update(s:SimulationSnapshot,menu:boolean){
  this.root.visible=!menu&&s.phase==='fight';for(const m of [...this.bubbles,...this.rings,...this.waves,...this.spiders])m.visible=false;if(!this.root.visible)return;
  let b=0,r=0,p=0,w=0;const time=s.frame/60;
  for(const f of s.fighters){
   if(f.characterId!=='astolfo'||!isActive(f))continue;
   const aura=(f.talkUntil??0)>s.frame,held=isTalking(f,s.frame);if(!aura&&!held)continue;
   const count=aura?10:6;
   for(let j=0;j<count;j++){
    const m=this.bubble(b++),phase=(time*1.5+j/count)%1;
    const angle=time*.7+j*2.4,dx=aura?Math.cos(angle)*ASTOLFO.auraRange*.8:f.facing*(35+phase*(ASTOLFO.talkRange-35));
    const y=aura?100+Math.sin(angle)*75:139+(j%3-1)*phase*65;
    m.visible=true;m.position.set(worldX(f.x+dx),(f.y+y)/100,.5);m.scale.setScalar(.4+phase*.25);m.rotation.z=Math.sin(time*4+j)*.12;m.material.opacity=Math.sin(phase*Math.PI)*.9;m.material.map=this.textures[aura&&j===0?2:j%2];
   }
   for(let j=0;j<3;j++){
    if(!aura){const m=this.wave(w++),phase=(time*1.8+j/3)%1;m.visible=true;m.material.opacity=Math.sin(phase*Math.PI)*.65;m.position.set(worldX(f.x+f.facing*(20+phase*(ASTOLFO.talkRange-75))),(f.y+139)/100,.2);m.scale.set(f.facing*(.12+phase*.55),.08+phase*.75,1);continue;}
    const m=this.ring(r++),phase=(time+j/3)%1;m.visible=true;m.material.color.set(aura?0xffdb77:0x9dd8f5);m.material.opacity=(1-phase)*.28;
    m.position.set(worldX(f.x+(aura?0:f.facing*ASTOLFO.talkRange/2)),(f.y+85)/100,.1);
    m.scale.set((aura?ASTOLFO.auraRange:ASTOLFO.talkRange/2)/100*(.65+phase*.35),.8*(.65+phase*.35),1);
   }
  }
  for(const h of s.hazards){
   const age=s.frame-(h.createdAt??s.frame);
   if(h.kind==='spider'||h.kind==='spider-bite'){
    const frame=astolfoSpiderFrames[Math.floor(age/5)%4];if(!frame)continue;
    const g=this.spider(p++),height=.18;g.visible=true;g.material.map=frame.texture;
    g.position.set(worldX(h.x),(h.y+(h.kind==='spider-bite'?Math.sin(age/18*Math.PI)*115:0))/100+height/2,.45);
    g.scale.set((h.variant??1)*height*frame.width/frame.height,height,1);
   }
   if(h.kind==='sad-burst'||h.kind==='angry-burst')for(let j=0;j<3;j++){
    const m=this.ring(r++),phase=Math.min(1,(age+j*4)/30);m.visible=true;m.material.color.set(h.kind==='sad-burst'?0x67baff:0xff5735);m.material.opacity=(1-phase)*.8;m.position.set(worldX(h.x),(h.y+75)/100,.5);m.scale.setScalar(phase*ASTOLFO.deathRadius/100);
   }
  }
 }
 dispose(){for(const m of [...this.bubbles,...this.rings,...this.waves,...this.spiders]){m.geometry.dispose();m.material.dispose();}this.textures.forEach(t=>t.dispose());this.root.clear();}
}
