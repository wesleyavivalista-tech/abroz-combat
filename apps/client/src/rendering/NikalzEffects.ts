import * as THREE from 'three';
import type {SimulationSnapshot} from '../../../../packages/game-core/types.js';
import {NIKALZ} from '../../../../packages/game-core/simulation/NikalzSystem.js';
import {worldX} from './StageCoordinates.js';
type Icon='box'|'bee'|'honey'|'wood'|'crack'|'wave'|'bar'|'dust'|'rock'|'crater'|'streak';
export class NikalzEffects{
 root=new THREE.Group();private textures=new Map<Icon,THREE.CanvasTexture>();private meshes:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>[]=[];private used=0;
 private swarmMesh?:THREE.InstancedMesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;
 private beeTransform=new THREE.Object3D();
 private prepareSwarms(count:number){
  if(!this.swarmMesh){
   const mesh=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:this.texture('bee'),transparent:true,depthWrite:false,toneMapped:false,side:THREE.DoubleSide}),Math.max(32,2**Math.ceil(Math.log2(Math.max(1,count)))));
   mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
   // Positions change every frame; a stale batch bounding sphere can hide live bees.
   mesh.frustumCulled=false;
   // Sort the batch at the original sprite depth, alongside the other effects.
   mesh.position.z=.36;this.swarmMesh=mesh;this.root.add(mesh);
  }else if(count>this.swarmMesh.instanceMatrix.count){
   // Keep the object/material identity (and transparent draw order), but release
   // the old GPU instance buffer before replacing it with a larger reusable one.
   this.swarmMesh.dispose();
   this.swarmMesh.instanceMatrix=new THREE.InstancedBufferAttribute(new Float32Array(2**Math.ceil(Math.log2(count))*16),16).setUsage(THREE.DynamicDrawUsage);
  }
  if(this.swarmMesh){this.swarmMesh.count=count;this.swarmMesh.visible=count>0;}
 }
 private texture(kind:Icon){
  const cached=this.textures.get(kind);if(cached)return cached;
  const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d')!;x.lineWidth=3;x.lineJoin='round';x.strokeStyle='#423523';
  if(kind==='box'){
   // Tall stacked natural wood boards, overhanging lid and dark entrance from the supplied hive reference.
   x.fillStyle='#9c774d';x.fillRect(89,15,20,103);x.strokeRect(89,15,20,103);
   for(let i=0;i<5;i++){x.fillStyle=['#c9a474','#d4b183','#c3a078'][i%3];x.fillRect(19,18+i*19,73,19);x.strokeRect(19,18+i*19,73,19);x.strokeStyle='#ac875d';x.lineWidth=1;for(let j=0;j<3;j++){x.beginPath();x.moveTo(23,23+i*19+j*4);x.lineTo(86,25+i*19+j*4);x.stroke();}x.strokeStyle='#423523';x.lineWidth=3;}
   x.fillStyle='#dbc29c';x.fillRect(13,10,99,12);x.strokeRect(13,10,99,12);x.fillStyle='#332b20';x.fillRect(38,104,37,10);x.fillStyle='#ab875d';x.fillRect(18,114,12,7);x.fillRect(81,114,12,7);
  }else if(kind==='bee'){
   x.fillStyle='#eaf9ffd9';for(const dx of [-16,16]){x.beginPath();x.ellipse(64+dx,41,18,27,dx/30,0,Math.PI*2);x.fill();x.stroke();}
   x.fillStyle='#f1bd3d';x.beginPath();x.ellipse(62,75,33,23,0,0,Math.PI*2);x.fill();x.stroke();x.fillStyle='#302b26';x.fillRect(46,55,10,40);x.fillRect(67,55,9,41);x.beginPath();x.arc(95,70,13,0,Math.PI*2);x.fill();x.fillStyle='#fff';x.fillRect(98,64,4,4);
  }else if(kind==='honey'){
   x.fillStyle='#de952a';x.beginPath();x.roundRect(31,38,67,75,12);x.fill();x.stroke();x.fillStyle='#efc56b';x.fillRect(27,24,75,19);x.strokeRect(27,24,75,19);x.fillStyle='#fff0bf';x.fillRect(36,65,56,27);x.fillStyle='#9f5d16';x.font='bold 13px sans-serif';x.fillText('HONEY',40,83);
  }else if(kind==='wood'){x.fillStyle='#c5a174';x.fillRect(10,44,108,37);x.strokeRect(10,44,108,37);x.strokeStyle='#97734b';x.beginPath();x.moveTo(18,56);x.lineTo(110,63);x.stroke();}
  else if(kind==='rock'){x.fillStyle='#61594b';x.beginPath();x.moveTo(15,78);x.lineTo(37,24);x.lineTo(90,18);x.lineTo(117,77);x.lineTo(76,109);x.closePath();x.fill();x.stroke();x.fillStyle='#a89a7e';x.beginPath();x.moveTo(37,24);x.lineTo(90,18);x.lineTo(73,58);x.lineTo(15,78);x.closePath();x.fill();}
  else if(kind==='dust'){const g=x.createRadialGradient(64,64,8,64,64,62);g.addColorStop(0,'#b6a58bbb');g.addColorStop(.5,'#a4947966');g.addColorStop(1,'#9a886800');x.fillStyle=g;x.fillRect(0,0,128,128);}
  else if(kind==='crater'){
   x.fillStyle='#221d18';x.beginPath();x.ellipse(64,70,58,35,0,0,Math.PI*2);x.fill();
   for(let i=0;i<12;i++){const a=i*Math.PI/6,r=43;const px=64+Math.cos(a)*r,py=66+Math.sin(a)*24;
    x.fillStyle=i%2?'#796956':'#9c8a70';x.strokeStyle='#302920';x.lineWidth=2;
    x.beginPath();x.moveTo(px-12,py+7);x.lineTo(px-8,py-9-(i%3)*3);x.lineTo(px+10,py-13);x.lineTo(px+16,py+6);x.lineTo(px+3,py+12);x.closePath();x.fill();x.stroke();}
   x.strokeStyle='#171412';for(let i=0;i<9;i++){const a=i*.7;x.beginPath();x.moveTo(64+Math.cos(a)*18,68+Math.sin(a)*10);x.lineTo(64+Math.cos(a)*43,68+Math.sin(a)*25);x.lineTo(64+Math.cos(a+.08)*62,68+Math.sin(a+.08)*40);x.stroke();}
  }
  else if(kind==='streak'){const g=x.createLinearGradient(0,64,128,64);g.addColorStop(0,'#fff6d9');g.addColorStop(.4,'#edcb91aa');g.addColorStop(1,'#e8b96a00');x.fillStyle=g;x.beginPath();x.moveTo(0,56);x.lineTo(128,64);x.lineTo(0,72);x.closePath();x.fill();}
  else if(kind==='crack'){x.strokeStyle='#2a2019';x.lineWidth=5;for(let i=0;i<9;i++){const a=i*Math.PI*2/9;x.beginPath();x.moveTo(64,64);x.lineTo(64+Math.cos(a)*27,64+Math.sin(a)*27);x.lineTo(64+Math.cos(a+.13)*43,64+Math.sin(a+.13)*43);x.lineTo(64+Math.cos(a)*61,64+Math.sin(a)*61);x.stroke();}}
  else if(kind==='wave'){const g=x.createRadialGradient(64,64,18,64,64,63);g.addColorStop(0,'#ffe3a000');g.addColorStop(.5,'#f6c47766');g.addColorStop(.75,'#fff0cce0');g.addColorStop(1,'#d39a5300');x.fillStyle=g;x.fillRect(0,0,128,128);}
  else{x.fillStyle='#f8cc62';x.fillRect(0,0,128,128);}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;this.textures.set(kind,t);return t;
 }
 private draw(kind:Icon,x:number,y:number,w:number,h:number,rotation=0,opacity=1){
  let mesh=this.meshes[this.used++];if(!mesh){mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,toneMapped:false,side:THREE.DoubleSide}));this.meshes.push(mesh);this.root.add(mesh);}
  mesh.visible=true;mesh.material.map=this.texture(kind);mesh.material.opacity=opacity;mesh.position.set(worldX(x),y/100,.36);mesh.scale.set(w/100,h/100,1);mesh.rotation.z=rotation;return mesh;
 }
 update(s:SimulationSnapshot,menu:boolean){
  this.root.visible=!menu;this.used=0;
  this.prepareSwarms(menu?0:(s.bees?.length??0)*18);
  if(!menu){
   let instance=0;
   for(const b of s.bees??[]){for(let i=0;i<18;i++){
    const a=s.frame*.0275+i*2.399+b.id,r=12+(i%5)*7,flap=.7+.3*Math.abs(Math.sin(s.frame*.9+i));
    const transform=this.beeTransform;
    transform.position.set(worldX(b.x+Math.cos(a)*r),(b.y+Math.sin(a*1.17)*r*.65)/100,0);
    transform.scale.set((10+(i%3)*2)/100,((8+(i%3))*flap)/100,1);transform.rotation.z=Math.sin(a)*.16;transform.updateMatrix();
    this.swarmMesh!.setMatrixAt(instance++,transform.matrix);
   }}
   if(instance)this.swarmMesh!.instanceMatrix.needsUpdate=true;
   for(const b of s.structures??[]){
    if(b.kind!=='bee-box')continue;
    if(b.phase==='built'){
     const shake=b.lastHitAt!==undefined&&s.frame-b.lastHitAt<10?Math.sin(s.frame*2)*3:0;
     this.draw('box',b.x+shake,b.y+46,70,100);
     this.draw('bar',b.x-30+30*b.health/b.maxHealth,b.y+104,60*b.health/b.maxHealth,4);
     const sinceSpawn=s.frame-(b.nextShot-NIKALZ.spawnInterval);
     if(b.shots&&sinceSpawn<24)for(let i=0;i<7;i++){const t=sinceSpawn/24;this.draw('bee',b.x+(i-3)*t*13,b.y+10+t*(50+i*5),12,10,Math.sin(s.frame+i));}
    }else if(b.phase==='collapsed'){
     const age=s.frame-b.createdAt,t=age/45;
     for(let i=0;i<8;i++)this.draw('wood',b.x+(i-3.5)*t*28,b.y+Math.max(4,25+(i%3)*23+age*2-age*age*.16),29,12,i+age*.1,1-t);
    }
   }
   for(const h of s.hazards)if(h.kind==='honey'){
    const age=s.frame-(h.createdAt??0),hop=age<24?Math.sin(age/24*Math.PI)*45:Math.sin(s.frame*.08)*4;
    this.draw('honey',h.x,h.y+20+hop,35,40,Math.sin(age*.1)*.08);
    if(age<30)this.draw('wave',h.x,h.y+20,50+age*3,50+age*3,0,1-age/30);
   }
   for(const w of s.foreheadWaves??[]){
    const age=s.frame-w.born,radius=Math.min(w.range,(age+1)*w.speed),fade=Math.max(0,1-Math.max(0,age-w.range/w.speed)/35),power=w.meteor?2.15:1;
    if(w.meteor){
     const craterFade=Math.min(1,(age+1)/3)*Math.max(0,1-Math.max(0,age-65)/80);
     this.draw('crater',w.x,w.y+8,620,145,0,craterFade);
     this.draw('crack',w.x,w.y+2,Math.min(1050,240+age*85),145,0,craterFade);
     if(age<7)this.draw('wave',w.x,w.y+65,540+age*65,390-age*24,0,(1-age/7)*.95);
     // Large radial fragments launch from the contact point, then fall into lingering dust.
     for(let i=0;i<36;i++){
      const side=i%2?1:-1,t=Math.max(0,age-(i%4)),vx=side*(4+(i%7)*2.3),vy=11+(i%6)*3.2;
      const py=vy*t-.24*t*t;
      if(py>=0&&t<70)this.draw('rock',w.x+vx*t,w.y+12+py,28+(i%4)*14,24+(i%4)*12,side*t*.09,Math.max(0,1-Math.max(0,t-35)/35));
      if(age<14)this.draw('streak',w.x+side*(35+age*9),w.y+50+(i%6)*17,130+age*14,22,-side*(i%6)*.21,(1-age/14)*.55);
     }
     for(let i=0;i<22;i++){
      const delay=i%5*2,t=age-delay;if(t<0||t>85)continue;
      const side=i%2?1:-1,spread=side*(25+t*(2+(i%4)));
      this.draw('dust',w.x+spread,w.y+22+(i%4)*14+t*.4,115+t*4,85+t*2,0,Math.min(1,t/5)*(1-t/85)*.8);
     }
     if(radius<w.range)for(const side of [-1,1]){
      this.draw('dust',w.x+side*radius,w.y+60,160,155,0,.8);
      this.draw('rock',w.x+side*radius,w.y+25,45,50,side*age*.25,.9);
     }
    }
    // Contact flash first, then spreading fractures, lifted stone and settling dust.
    const spread=Math.min(1,(age+1)/8);
    this.draw('crack',w.x,w.y+3,220*power*spread,42*power*spread,0,fade);
    if(age<5)this.draw('wave',w.x,w.y+10,95*power,38*power,0,1-age/5);
    for(const side of [-1,1]){
     if(radius<w.range)for(let j=0;j<4;j++){
      const px=w.x+side*Math.max(0,radius-j*24),lift=Math.sin((age+j)*.8)*8;
      this.draw('dust',px,w.y+18+j*5,65*power,48*power,0,fade*(1-j*.16));
      this.draw('rock',px,w.y+14+lift,18*power,20*power,side*age*.1,fade);
     }
     for(let j=0;j<7;j++){
      const delay=j*2,t=age-delay;if(t<0)continue;
      const px=w.x+side*Math.min(w.range,j*40*power);
      this.draw('crack',px,w.y+2,75*power,20*power,side*.13,fade*.8);
      if(t<30){this.draw('rock',px+side*t*1.4,w.y+Math.max(2,10+t*(4+j*.2)-t*t*.17),12+(j%3)*8,11+(j%3)*7,side*t*.14,Math.max(0,1-t/30));this.draw('dust',px+side*t,w.y+12+t*.5,40+t*3,25+t*1.8,0,(1-t/30)*.7);}
     }
    }
   }
   for(const f of s.fighters){
    if(f.meteorStart!==undefined&&s.frame-f.meteorStart>=54){
     const t=Math.min(1,(s.frame-f.meteorStart-54)/20);
     // Forehead is the bright leading point; the long wake stays above the body.
     this.draw('wave',f.x,f.y+12,65+t*45,55+t*30,0,.8);
     for(let i=0;i<7;i++)this.draw('streak',f.x+(i-3)*15,f.y+150+i%3*45,220+t*240,12+i%2*8,-Math.PI/2,.35+t*.4);
    }
    if((f.beeSlowUntil??0)>s.frame)for(let i=0;i<3;i++)this.draw('bee',f.x+Math.cos(s.frame*.0375+i*2)*35,f.y+100+Math.sin(s.frame*.0325+i*2)*45,10,9);
   }
  }
  for(let i=this.used;i<this.meshes.length;i++)this.meshes[i].visible=false;
 }
 dispose(){if(this.swarmMesh){this.swarmMesh.dispose();this.swarmMesh.geometry.dispose();this.swarmMesh.material.dispose();this.swarmMesh=undefined;}for(const m of this.meshes){m.geometry.dispose();m.material.dispose();}this.textures.forEach(t=>t.dispose());this.root.clear();}
}
