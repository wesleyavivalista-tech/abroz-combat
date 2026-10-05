import * as THREE from 'three';
import type {SimulationSnapshot,Structure} from '../../../../../packages/game-core/types.js';
import {HOUSE_WALL_THICKNESS} from '../../../../../packages/game-core/simulation/StructureSystem.js';
import {characters} from '../../../../../packages/game-core/characters/registry.js';
import {worldX} from '../../rendering/StageCoordinates.js';
import {loadTexture} from '../../rendering/TextureCache.js';
import {luizinhoAtlases} from './atlas.js';
const sheets=['structures','products','construction-v2','site-bricks-wood-v3'] as const;
type Plane=THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
export class StructureEffects{
 root=new THREE.Group();private textures:THREE.Texture[]=[];private pending?:Promise<void>;private meshes:Plane[]=[];private used=0;
 async load():Promise<void>{
  if(!this.pending)this.pending=Promise.all(sheets.map(async name=>{const t=await loadTexture(`/art/luizinho/${name}.png`);t.colorSpace=THREE.SRGBColorSpace;t.generateMipmaps=false;t.magFilter=t.minFilter=THREE.LinearFilter;return t;})).then(t=>{this.textures=t;}).catch(e=>{this.pending=undefined;throw e;});
  return this.pending;
 }
 private add(x:number,y:number,w:number,h:number,color:number,alpha=1,sheet=-1,pose=0,circle=false):Plane{
  let mesh=this.meshes[this.used++];
  if(!mesh){mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));this.meshes.push(mesh);this.root.add(mesh);}
  if((mesh.geometry.type==='CircleGeometry')!==circle){mesh.geometry.dispose();mesh.geometry=circle?new THREE.CircleGeometry(.5,24):new THREE.PlaneGeometry(1,1);}
  mesh.visible=true;mesh.position.set(worldX(x),y/100,.24);mesh.scale.set(w/100,h/100,1);mesh.rotation.z=0;mesh.material.depthWrite=false;mesh.material.color.set(color);mesh.material.opacity=alpha;
  const hadMap=!!mesh.material.map;
  if(sheet>=0&&this.textures[sheet]){
   const source=this.textures[sheet];
   if(!mesh.material.map||mesh.material.map.image!==source.image){mesh.material.map?.dispose();mesh.material.map=source.clone();mesh.material.map.needsUpdate=true;}
   const data=luizinhoAtlases[sheets[sheet]],[l,t,r,b]=data.frames[pose];
   mesh.material.map.repeat.set((r-l+1)/data.width,(b-t+1)/data.height);mesh.material.map.offset.set(l/data.width,1-(b+1)/data.height);
  }else{mesh.material.map?.dispose();mesh.material.map=null;}
  if(hadMap!==!!mesh.material.map)mesh.material.needsUpdate=true;
  return mesh;
 }
 private crop(mesh:Plane,u:number,v:number,w:number,h:number):void{
  const tex=mesh.material.map;if(!tex)return;
  const rx=tex.repeat.x,ry=tex.repeat.y;tex.offset.x+=u*rx;tex.offset.y+=v*ry;tex.repeat.set(rx*w,ry*h);
 }
 private impact(b:Structure,frame:number):void{
  if(b.lastHitAt===undefined)return;
  const age=frame-b.lastHitAt;if(age<0||age>=18)return;
  const x=b.hitX??b.x,y=b.hitY??b.y+b.height/2,fade=1-age/18;
  for(let i=0;i<8;i++){
   const angle=i*Math.PI/4+.25,d=8+age*(1.6+(i%3)*.65);
   const chip=this.add(x+Math.cos(angle)*d,y+Math.sin(angle)*d-age*age*.09,7+i%3*3,4+i%2*3,i%2?0xcb9b64:0xb36343,fade);
   chip.rotation.z=i+age*.22;
  }
  if(age<5){const flash=this.add(x,y,32+age*6,5,0xffdf9c,1-age/5);flash.rotation.z=.5;const cross=this.add(x,y,5,32+age*6,0xffe9c4,1-age/5);cross.rotation.z=.5;}
 }
 private demolition(b:Structure,age:number):void{
  const fade=Math.max(0,1-Math.max(0,age-28)/17),shake=age<7?Math.sin(age*2.6)*(7-age):0;
  // Break the actual brick/wood artwork into pieces, pulling both sides inward.
  const cols=5,rows=5;
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
   const delay=4+(rows-1-row)*1.1+(col%2)*1.5,t=Math.max(0,age-delay),u=col/cols,v=row/rows;
   const startX=(col+.5)/cols-.5,startY=(row+.5)/rows*b.height;
   const inward=Math.min(.85,t/30),x=b.x+startX*b.width*(1-inward)+shake;
   const floor=6+(col%3)*7+(row%2)*4,y=b.y+Math.max(floor,startY-t*t*.68);
   const chunk=this.add(x,y,b.width/cols,b.height/rows,0xffffff,fade,2,1);this.crop(chunk,u,v,1/cols,1/rows);
   chunk.rotation.z=Math.sign(startX)*Math.min(1.5,t*.045)+(row%2?1:-1)*t*.013;
   chunk.position.z=row===0?.27:-.08;
  }
  if(age>8)for(let i=0;i<12;i++){
   const t=(age-8)/37,spread=(i-5.5)*b.width/14*(.5+t*.7),size=30+t*70;
   const dust=this.add(b.x+spread,b.y+12+Math.sin(i*1.7)*8+t*30,size,size*.55,0xb8a18a,Math.min(.38,(age-8)/15)*Math.max(0,1-t),-1,0,true);dust.position.z=.3;
  }
 }
 private breakApart(b:Structure,age:number):void{
  const fade=Math.max(0,1-Math.max(0,age-28)/17),cols=4,rows=4;
  const turret=b.kind==='turret',facing=turret?b.facing:1;
  // Crop the existing artwork so bricks, planks and metal break away together.
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
   const t=Math.max(0,age-(rows-1-row)*1.2),side=(col+.5)/cols-.5;
   const x=b.x+facing*side*b.width+side*t*(turret?3:2);
   const startY=(row+.5)/rows*b.height;
   const y=b.y+Math.max(5+(col%2)*5,startY+t*(row%2?1.2:2)-t*t*.48);
   const piece=this.add(x,y,b.width/cols,b.height/rows,0xffffff,fade,turret?2:0,0);
   this.crop(piece,col/cols,row/rows,1/cols,1/rows);piece.scale.x*=facing;
   piece.rotation.z=side*t*.09;
  }
  for(let i=0;i<8;i++){
   const t=Math.max(0,age-5),size=12+t*1.5;
   const dust=this.add(b.x+(i-3.5)*(b.width/9+t*.4),b.y+8+t*.45,size,size*.55,0xb8a18a,Math.min(.35,t/15)*fade,-1,0,true);dust.position.z=.3;
  }
  this.impact(b,b.createdAt+age);
 }
 update(s:SimulationSnapshot,menu:boolean):void{
  this.meshes.forEach(m=>m.visible=false);this.used=0;if(menu)return;
  for(const b of s.structures??[]){
   if(b.kind==='bee-box')continue;
   const age=s.frame-b.createdAt;
   if(b.phase==='marked'){
    // Sparse bricks and planks mark the construction footprint.
    const props=luizinhoAtlases['site-bricks-wood-v3'].frames[0],height=b.width*(props[3]-props[1]+1)/(props[2]-props[0]+1);
    const site=this.add(b.x,b.y+height/2,b.width,height,0xffffff,1,3,0);site.position.z=-.1;site.material.depthWrite=true;
    continue;
   }
   if(b.phase==='collapsed'){if(b.kind==='house')this.demolition(b,age);else this.breakApart(b,age);continue;}
   const hitAge=b.lastHitAt===undefined?99:s.frame-b.lastHitAt,hit=hitAge>=0&&hitAge<12;
   const shake=hit?Math.sin(hitAge*2.4)*(1-hitAge/12)*5:0;
   const grow=Math.min(1,(age+1)/18),alpha=1;
   const width=b.width,height=b.height*grow;
   const mesh=this.add(b.x+shake,b.y+height/2,width,height,hit?0xffd3a3:0xffffff,alpha,b.kind==='wall'?0:2,b.kind==='wall'?0:b.kind==='turret'?0:1);
   if(b.kind==='wall')mesh.rotation.z=hit?shake*.002:0;
   if(b.kind==='turret'){
    // Keep the brick foundation upright while the wooden gun carriage pitches.
    mesh.scale.y*=.55;mesh.position.y=(b.y+height*.275)/100;mesh.scale.x*=b.facing;this.crop(mesh,0,0,1,.55);
    const ax=b.aimX??b.facing,ay=b.aimY??0,theta=b.facing*Math.atan2(ay,Math.abs(ax));
    const spec=characters[s.fighters[b.owner].characterId].moves[b.move].structure!;
    const shotAge=b.shots?s.frame-(b.nextShot-(spec.interval??60)):99,recoil=Math.max(0,1-shotAge/8)*5;
    const dx=b.facing*width*.18,dy=height*.0675,pivotX=b.x-b.facing*width*.18+shake,pivotY=b.y+height*.7075;
    const gun=this.add(pivotX+dx*Math.cos(theta)-dy*Math.sin(theta)-ax*recoil,pivotY+dx*Math.sin(theta)+dy*Math.cos(theta)-ay*recoil,width,height*.45,hit?0xffd3a3:0xffffff,alpha,2,0);
    gun.scale.x*=b.facing;gun.rotation.z=theta;this.crop(gun,0,.55,1,.45);
    if(shotAge>=0&&shotAge<4){const length=b.width*.68+18;const flash=this.add(b.x-b.facing*b.width*.18+ax*length,b.y+85+ay*length,30,18,0xffd98a,1-shotAge/4,-1,0,true);flash.rotation.z=Math.atan2(ay,ax);}
   }
   if(b.kind==='house'){
    // The rear interior is behind the fighters; the solid cutaway edges are in front.
    mesh.position.z=-.12;mesh.material.depthWrite=true;
    {
     const thickness=HOUSE_WALL_THICKNESS,w=thickness/b.width,h=thickness/b.height;
     for(const [u,v,uw,vh] of [[0,0,w,1],[1-w,0,w,1],[w,1-h,1-2*w,h]]){
      const edge=this.add(b.x+shake-b.width/2+(u+uw/2)*b.width,b.y+(v+vh/2)*height,uw*b.width,vh*height,0xffffff,1,2,1);
      this.crop(edge,u,v,uw,vh);
      if(b.lastHitAt!==undefined&&s.frame-b.lastHitAt<8)edge.material.color.set(0xffc48a);
     }
    }
   }
   this.impact(b,s.frame);
   {
    this.add(b.x,b.y+b.height+15,b.width,8,0x101820,.95);
    this.add(b.x-b.width/2+b.width*b.health/b.maxHealth/2,b.y+b.height+15,b.width*b.health/b.maxHealth,5,0x60d2ab);

   }
  }
  for(const p of s.projectiles){
   if(!p.active)continue;
   const visual=characters[s.fighters[p.owner].characterId].moves[p.move].projectile?.visual;
   if(visual==='product'){
    const pose=p.variant??0,[l,t,r,b]=luizinhoAtlases.products.frames[pose],ratio=(r-l+1)/(b-t+1),w=ratio>1?44:44*ratio,h=ratio>1?44/ratio:44;
    const mesh=this.add(p.x,p.y,w,h,0xffffff,1,1,pose);mesh.rotation.z=s.frame*.08*Math.sign(p.vx);
   }else if(visual==='cannonball'){
    const speed=Math.hypot(p.vx,p.vy??0)||1,trail=this.add(p.x-p.vx/speed*25,p.y-(p.vy??0)/speed*25,45,8,0xffc372,.55);trail.rotation.z=Math.atan2(p.vy??0,p.vx);
    this.add(p.x,p.y,30,30,0x222933,1,-1,0,true);this.add(p.x-5,p.y+5,9,9,0xc0d4df,1,-1,0,true);
   }
  }
 }
 dispose():void{this.meshes.forEach(m=>{m.material.map?.dispose();m.material.dispose();m.geometry.dispose();});this.meshes=[];this.root.clear();}
}
