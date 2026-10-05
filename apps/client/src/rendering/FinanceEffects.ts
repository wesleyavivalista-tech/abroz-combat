import * as THREE from 'three';
import type {SimulationSnapshot} from '../../../../packages/game-core/types.js';
import {characters} from '../../../../packages/game-core/characters/registry.js';
import {worldX,renderStage} from './StageCoordinates.js';
import {lightBeam} from '../../../../packages/game-core/simulation/LightBeamSystem.js';
import {FINANCE} from '../../../../packages/game-core/simulation/FinanceSystem.js';
type Icon='wine'|'feather'|'coin'|'bill'|'bag'|'burst'|'area'|'beam'|'impact';
/** Small game-native props remain crisp at gameplay scale; pooled meshes avoid allocations per coin. */
export class FinanceEffects{
 root=new THREE.Group();private textures=new Map<Icon,THREE.CanvasTexture>();private meshes:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>[]=[];private used=0;
 private texture(kind:Icon){
  const cached=this.textures.get(kind);if(cached)return cached;
  const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d')!;x.lineJoin='round';x.lineWidth=5;x.strokeStyle='#172129';
  if(kind==='wine'){
   x.fillStyle='#3d773b';x.beginPath();x.moveTo(52,8);x.lineTo(76,8);x.lineTo(76,39);x.lineTo(87,52);x.lineTo(87,116);x.lineTo(41,116);x.lineTo(41,52);x.lineTo(52,39);x.closePath();x.fill();x.stroke();x.fillStyle='#982c42';x.fillRect(50,7,28,15);x.fillStyle='#f0dfb4';x.fillRect(45,67,38,29);x.fillStyle='#7f2342';x.font='bold 12px serif';x.fillText('WINE',47,86);x.fillStyle='#d9eea9';x.fillRect(48,51,5,12);
  }else if(kind==='feather'){
   x.fillStyle='#e5f8ff';x.beginPath();x.moveTo(15,115);x.quadraticCurveTo(9,15,111,11);x.quadraticCurveTo(111,99,15,115);x.fill();x.stroke();x.strokeStyle='#81b5d5';x.lineWidth=3;x.beginPath();x.moveTo(13,116);x.lineTo(98,26);for(let i=0;i<5;i++){x.moveTo(30+i*13,99-i*13);x.lineTo(27+i*11,67-i*11);}x.stroke();
  }else if(kind==='coin'){
   x.fillStyle='#ac6624';x.beginPath();x.ellipse(64,67,40,48,0,0,Math.PI*2);x.fill();x.stroke();x.fillStyle='#ffd166';x.beginPath();x.ellipse(60,61,34,43,0,0,Math.PI*2);x.fill();x.strokeStyle='#fff0b5';x.stroke();x.fillStyle='#a9671e';x.font='bold 62px serif';x.fillText('$',41,81);
  }else if(kind==='bill'){
   x.fillStyle='#7eb291';x.fillRect(6,32,116,64);x.strokeRect(6,32,116,64);x.strokeStyle='#d5e5b9';x.lineWidth=3;x.strokeRect(14,40,100,48);x.fillStyle='#c9ddac';x.beginPath();x.ellipse(64,64,22,27,0,0,Math.PI*2);x.fill();x.fillStyle='#386448';x.font='bold 37px serif';x.fillText('$',54,78);
  }else if(kind==='bag'){
   x.fillStyle='#b89759';x.beginPath();x.moveTo(44,28);x.lineTo(36,7);x.lineTo(85,7);x.lineTo(79,29);x.bezierCurveTo(125,60,128,117,64,119);x.bezierCurveTo(1,118,8,63,44,28);x.fill();x.stroke();x.fillStyle='#432b21';x.fillRect(38,25,47,8);x.font='bold 64px serif';x.fillText('$',44,91);
  }else if(kind==='impact'){
   x.fillStyle='#ffd36b';x.beginPath();for(let i=0;i<24;i++){const a=i*Math.PI/12,r=i%2?20:59;const px=64+Math.cos(a)*r,py=64+Math.sin(a)*r;if(i)x.lineTo(px,py);else x.moveTo(px,py);}x.closePath();x.fill();x.fillStyle='#fff7d9';x.beginPath();x.arc(64,64,17,0,Math.PI*2);x.fill();
  }else if(kind==='burst'){
   const glow=x.createRadialGradient(64,64,2,64,64,64);glow.addColorStop(0,'#ffffff');glow.addColorStop(.2,'#ffffda');glow.addColorStop(.5,'#a1dfffaa');glow.addColorStop(1,'#83d2ff00');x.fillStyle=glow;x.fillRect(0,0,128,128);
  }else if(kind==='beam'){const glow=x.createLinearGradient(0,0,128,0);glow.addColorStop(0,'#7bbdff00');glow.addColorStop(.18,'#8bc9ffaa');glow.addColorStop(.38,'#ffe8a9');glow.addColorStop(.5,'#ffffff');glow.addColorStop(.62,'#ffe8a9');glow.addColorStop(.82,'#8bc9ffaa');glow.addColorStop(1,'#7bbdff00');x.fillStyle=glow;x.fillRect(0,0,128,128);
  }else{ x.fillStyle='#e6ba542a';x.fillRect(2,2,124,124);x.strokeStyle='#fbd879';x.lineWidth=3;x.strokeRect(3,3,122,122); }
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.magFilter=THREE.NearestFilter;t.minFilter=THREE.LinearFilter;this.textures.set(kind,t);return t;
 }
 private draw(kind:Icon,x:number,y:number,w:number,h:number,rotation=0,opacity=1){
  let mesh=this.meshes[this.used++];if(!mesh){mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,toneMapped:false,side:THREE.DoubleSide}));this.meshes.push(mesh);this.root.add(mesh);}
  mesh.visible=true;mesh.material.map=this.texture(kind);mesh.material.opacity=opacity;mesh.position.set(worldX(x),y/100,.32);mesh.scale.set(w/100,h/100,1);mesh.rotation.z=rotation;return mesh;
 }
 update(s:SimulationSnapshot,menu:boolean){
  this.root.visible=!menu;this.used=0;
  if(!menu){
   for(const p of s.projectiles){if(!p.active)continue;const m=characters[s.fighters[p.owner].characterId].moves[p.move];if(m.projectile?.visual==='wine')this.draw('wine',p.x,p.y,35,55,-s.frame*.17);else if(m.financeAbility==='feathers')this.draw('feather',p.x,p.y,35,35,Math.atan2(p.vy??-12,p.vx)-.8);}
   const rainCount=s.hazards.filter(h=>h.kind==='coin-rain').length,coinsPerArea=Math.max(2,Math.min(24,Math.floor(256/Math.max(1,rainCount))));
   for(const h of s.hazards){
    if(h.kind==='money-bill')this.draw('bill',h.x,h.y+Math.sin(s.frame*.07+h.x)*5,43,29,Math.sin(s.frame*.03+h.x)*.15);
    if(h.kind==='coin-rain'){
     const age=s.frame-(h.createdAt??s.frame),rainAge=age-FINANCE.bagFlightFrames,top=h.y+540;
     this.draw('area',h.x,h.y+3,FINANCE.rainWidth,6,0,rainAge<0?.25:.7);
     if(rainAge<0){
      const t=Math.max(0,age/FINANCE.bagFlightFrames),startX=h.launchX??h.x,startY=h.launchY??h.y+180;
      this.draw('bag',startX+(h.x-startX)*t,startY+(top-startY)*t+Math.sin(t*Math.PI)*100,54,62,-t*2);
     }else{
      if(rainAge<24){
       const t=rainAge/24;this.draw('impact',h.x,top,85+t*160,85+t*130,t,1-t);
       for(let i=0;i<12;i++){const a=i*Math.PI/6;this.draw('coin',h.x+Math.cos(a)*t*145,top+Math.sin(a)*t*85-t*t*75,18,24,a+t*4,1-t);}
      }
      for(let i=0;i<coinsPerArea;i++){const x=h.x-FINANCE.rainWidth/2+((i*137+37)%FINANCE.rainWidth),y=h.y+540-((rainAge*15+i*83)%530);this.draw('coin',x,y,14+Math.abs(Math.sin(age*.2+i))*9,24,0,.9);}
     }
    }
   }
   for(const f of [...s.fighters,...s.clones.map(c=>c.fighter)]){
    if(f.coinHitAt!==undefined){const age=s.frame-f.coinHitAt;if(age>=0&&age<10){
     const t=age/10,side=Math.sin(f.coinHitAt*1.7)>0?1:-1;
     this.draw('impact',f.x+side*16,f.y+105,48+t*45,55+t*45,t*2,1-t);
     for(let i=0;i<5;i++){const a=i*Math.PI*.4;this.draw('coin',f.x+Math.cos(a)*(18+t*65),f.y+100+Math.sin(a)*(20+t*65)-t*t*50,10,15,a+t*5,1-t);}
    }}
    if(f.angelUntil){const ray=lightBeam(f,renderStage.width,renderStage.floorHeight);if(ray){const endY=ray.y+ray.dy*ray.length;this.draw('beam',ray.x,ray.y+ray.dy*ray.length/2,ray.width*1.5,ray.length,0,.85+.15*Math.sin(s.frame*.8));this.draw('burst',ray.x,endY+8,150,65,0,.85);for(let i=0;i<10;i++){const phase=(s.frame*.05+i*.13)%1;this.draw('burst',ray.x+Math.sin(i*2.4)*phase*85,endY+phase*70,10,15,0,1-phase);}}}
    if(f.angelBurstAt!==undefined){const age=s.frame-f.angelBurstAt;if(age>=0&&age<30)this.draw('burst',f.x,f.y+95,180+age*12,220+age*12,0,1-age/30);}}
  }
  for(let i=this.used;i<this.meshes.length;i++)this.meshes[i].visible=false;
 }
 dispose(){for(const m of this.meshes){m.geometry.dispose();m.material.dispose();}this.textures.forEach(t=>t.dispose());this.root.clear();}
}
