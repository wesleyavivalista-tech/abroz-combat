import * as THREE from "three";

const STRANDS=12, SEGMENTS=28, SIDES=5;
/** One pooled mesh: braided tail and opening, hooked strands at the collision center. */
export class HairGripProjectile extends THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial> {
  constructor(){
    const geometry=new THREE.BufferGeometry();
    const count=STRANDS*(SEGMENTS+1)*SIDES;
    geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(count*3),3).setUsage(THREE.DynamicDrawUsage));
    const colors=new Float32Array(count*3),indices:number[]=[];
    const palette=['#241712','#4a3021','#805237','#ad7850','#563927'];
    for(let strand=0;strand<STRANDS;strand++)for(let segment=0;segment<=SEGMENTS;segment++)for(let side=0;side<SIDES;side++){
      const vertex=(strand*(SEGMENTS+1)+segment)*SIDES+side;
      const color=new THREE.Color(palette[(side+strand%3)%palette.length]);
      color.toArray(colors,vertex*3);
      if(segment<SEGMENTS){const a=vertex,b=(strand*(SEGMENTS+1)+segment)*SIDES+(side+1)%SIDES,c=a+SIDES,d=b+SIDES;indices.push(a,b,c,b,d,c);}
    }
    geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.setIndex(indices);
    // The strand positions move each tick; keep culling independent of the initial empty buffer.
    geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(-.4,0,0),1.4);
    super(geometry,new THREE.MeshBasicMaterial({vertexColors:true,toneMapped:false,side:THREE.DoubleSide}));
    this.visible=false;
  }
  animate(frame:number,seed:number,age:number):void{
    const positions=this.geometry.getAttribute('position') as THREE.BufferAttribute;
    const time=frame/60,extension=Math.min(1,Math.max(.3,age/9));
    for(let strand=0;strand<STRANDS;strand++)for(let segment=0;segment<=SEGMENTS;segment++){
      const t=segment/SEGMENTS,angle=strand*Math.PI*2/STRANDS;
      // Braids gather into a dense neck before separating into a grasping claw.
      const tip=Math.max(0,(t-.68)/.32),curl=tip*Math.PI*1.35;
      const taper=Math.min(1,t/.2);
      const radius=(.045+.035*Math.sin(t*Math.PI)+Math.sin(tip*Math.PI)*.17)*taper;
      const twist=angle+Math.min(t,.68)*15-time*7;
      const x=(-1.05+t*1.05+Math.sin(curl)*.2)*extension;
      const sway=Math.sin(t*8-time*11+seed)*.055*(1-t);
      const y=Math.sin(twist)*radius+sway;
      const z=Math.cos(twist)*radius*.55;
      const thickness=(.009+.011*Math.sin(t*Math.PI))*(1-tip*.82)*Math.min(1,t/.12);
      for(let side=0;side<SIDES;side++){
        const a=side*Math.PI*2/SIDES;
        positions.setXYZ((strand*(SEGMENTS+1)+segment)*SIDES+side,x,y+Math.sin(a)*thickness,z+Math.cos(a)*thickness);
      }
    }
    positions.needsUpdate=true;
  }
}
