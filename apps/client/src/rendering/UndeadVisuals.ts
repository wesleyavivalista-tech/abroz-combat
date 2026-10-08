import * as THREE from 'three';
import type {HairClone,SimulationSnapshot} from '../../../../packages/game-core/types.js';
import {ZombieSpriteRenderer} from './ZombieSpriteRenderer.js';
import {graveArt,graveDamagePose,graveRubbleOpacity} from './GraveArt.js';
import type {Frame} from './DodoRenderer.js';
import {worldX} from './StageCoordinates.js';
interface Visual {grave:boolean;root:THREE.Group;stone:THREE.Mesh;claws:THREE.Line[];fighter?:ZombieSpriteRenderer;}
/** Cross grave markers and dedicated illustrated undead sprites. */
export class UndeadVisuals {
 root=new THREE.Group();private visuals=new Map<number,Visual>();
 constructor(private art:()=>readonly Frame[]|undefined=graveArt){}
 private create():Visual {
  const root=new THREE.Group();this.root.add(root);
  const stone=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({transparent:true,alphaTest:.1,side:THREE.DoubleSide,toneMapped:false}));root.add(stone);
  const claws=Array.from({length:3},(_,i)=>{const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(.30,.95+i*.10,.35),new THREE.Vector3(.75,1.02+i*.10,.35),new THREE.Vector3(1.1,.68+i*.10,.35)]),new THREE.LineBasicMaterial({color:'#d8ef9a',transparent:true,opacity:.85}));this.root.add(line);return line;});
  return {grave:true,root,stone,claws};
 }
 update(s:SimulationSnapshot,menu:boolean):void {
  const ids=new Set(s.clones.filter(c=>c.undead).map(c=>c.id));
  for(const [id,v] of this.visuals)if(!ids.has(id)){this.remove(v);this.visuals.delete(id);}
  for(const c of s.clones){if(!c.undead)continue;let v=this.visuals.get(c.id);if(v?.fighter&&v.fighter.characterId!==c.fighter.characterId){this.remove(v);this.visuals.delete(c.id);v=undefined;}if(!v){v=this.create();this.visuals.set(c.id,v);}this.updateOne(v,c,s,menu);}
 }
 private updateOne(v:Visual,c:HairClone,s:SimulationSnapshot,menu:boolean):void {
  const f=c.fighter,u=c.undead!,age=s.frame-u.phaseAt,grave=f.undead==='grave';
  v.grave=grave;
  v.root.visible=!menu&&s.phase==='fight';v.root.position.set(worldX(grave?f.x:u.spawnX),(grave?f.y:u.spawnY)/100,.12);
  const rising=f.undead==='rising',frames=this.art(),art=frames?.[graveDamagePose(f.health,rising,age)];
  v.stone.visible=(grave||rising)&&!!art;
  if(art){
   const scale=1.10/(art.referenceHeight??art.height);
   const material=v.stone.material as THREE.MeshBasicMaterial;material.map=art.texture;
   material.opacity=rising?graveRubbleOpacity(age):1;
   v.stone.scale.set(art.width*scale,art.height*scale,1);
   v.stone.position.set((art.width/2-art.pivot)*scale,art.height*scale/2,.23);
  }
  v.claws.forEach(line=>line.visible=false);
  if(grave){if(v.fighter){v.fighter.root.visible=false;v.fighter.shadow.visible=false;}return;}
  if(!v.fighter){v.fighter=new ZombieSpriteRenderer(f.characterId);this.root.add(v.fighter.root,v.fighter.shadow);}
  v.fighter.update(f,u,s.frame);v.fighter.root.visible=v.root.visible;v.fighter.shadow.visible&&=v.root.visible;
  if(f.state==='LightAttack')v.claws.forEach((line,i)=>{const tick=u.attackFrame;line.visible=v.root.visible&&tick>=18&&tick<27;line.position.set(worldX(f.x),f.y/100,0);line.scale.x=f.facing;line.rotation.z=-f.facing*(tick-18)*.07;(line.material as THREE.LineBasicMaterial).opacity=(1-(tick-18)/9)*(.9-i*.1);});
 }
 forEachGrave(visit:(id:number,root:THREE.Group)=>void):void{for(const [id,v] of this.visuals)if(v.grave&&v.stone.visible)visit(id,v.root);}
 forEachFighter(visit:(id:number,visual:ZombieSpriteRenderer)=>void):void{for(const [id,v] of this.visuals)if(v.fighter&&!v.grave)visit(id,v.fighter);}
 private remove(v:Visual):void {
  v.fighter?.dispose();if(v.fighter)this.root.remove(v.fighter.root,v.fighter.shadow);
  const dispose=(o:THREE.Object3D)=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}};
  v.root.traverse(dispose);this.root.remove(v.root);for(const line of v.claws){dispose(line);this.root.remove(line);}
 }
 dispose():void{for(const v of this.visuals.values())this.remove(v);this.visuals.clear();}
}
