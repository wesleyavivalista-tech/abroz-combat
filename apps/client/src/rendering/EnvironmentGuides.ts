import * as THREE from 'three';
/** Development-only world-space guides. Shared geometry, allocated only when requested. */
export class EnvironmentGuides {
 readonly root=new THREE.Group();
 private geometry=new THREE.BufferGeometry().setFromPoints(Array.from({length:65},(_,i)=>new THREE.Vector3(Math.cos(i*Math.PI/32),Math.sin(i*Math.PI/32),0)));
 private material=new THREE.LineBasicMaterial({color:'#ffce76',transparent:true,opacity:.6,depthTest:false});
 private radii=Array.from({length:8},()=>new THREE.Line(this.geometry,this.material));
 private arrow=new THREE.ArrowHelper(new THREE.Vector3(-.5,-1,0).normalize(),new THREE.Vector3(),1,0x9eeaff);
 constructor(){this.root.name='environment-guides';for(const ring of this.radii){ring.renderOrder=1000;this.root.add(ring);}this.root.add(this.arrow);}
 update(positions:readonly THREE.Vector4[],count:number,anchorX:number,surface:number,direction:{x:number;y:number}):void{
  this.radii.forEach((ring,i)=>{ring.visible=i<count;if(ring.visible){const p=positions[i];ring.position.set(p.x,p.y,.5);ring.scale.setScalar(p.z);}});
  this.arrow.position.set(anchorX,surface+4,.5);
  const d=new THREE.Vector3(direction.x,direction.y,0);if(d.lengthSq()<.001)d.set(0,-1,0);this.arrow.setDirection(d.normalize());
 }
 dispose():void{this.geometry.dispose();this.material.dispose();this.arrow.dispose();this.root.removeFromParent();}
}
