import * as THREE from 'three';
const ease=(n:number)=>{const t=Math.max(0,Math.min(1,n));return t*t*(3-2*t);};
/** Grow before contact, hold through the hit window, then reel the hair back in. */
export function hairSpearExtension(frame:number,startup:number,active:number):number {
 return frame<startup?ease((frame-8)/(startup-8)):1-ease((frame-startup-active)/16);
}
/** Extend by feeding more hair from the root. Every illustrated pixel retains its
 * original scale: the body and pointed tip are rigid, the shaft repeats at 1:1. */
export function updateHairSpear(geometry:THREE.BufferGeometry,left:number,width:number,extra:number,seam:number,low:number,high:number):void {
 const positions:number[]=[],uvs:number[]=[];
 const quad=(x:number,length:number,source:number,sourceLength:number,bottom=low,top=high)=>{
  for(const [dx,y] of [[0,0],[1,0],[1,1],[0,0],[1,1],[0,1]]){
   positions.push((x+dx*length)/width-.5,bottom+y*(top-bottom)-.5,0);
   uvs.push((source+dx*sourceLength)/width,bottom+y*(top-bottom));
  }
 };
 const split=seam-left;
 quad(0,width,0,width,0,low);
 quad(0,width,0,width,high,1);
 quad(0,split,0,split);
 let offset=0,index=0;
 while(offset<extra){
  const length=Math.min(20,extra-offset),reverse=index%2===0;
  quad(split+offset,length,reverse?split:split-20,reverse?-length:length);
  offset+=length;index++;
 }
 quad(split+extra,width-split,split,width-split);
 if(!geometry.userData.hairBuffers){
  geometry.setIndex(null);
  geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(4096*3),3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(4096*2),2).setUsage(THREE.DynamicDrawUsage));
  geometry.userData.hairBuffers=true;
 }
 const p=geometry.attributes.position as THREE.BufferAttribute,u=geometry.attributes.uv as THREE.BufferAttribute;
 (p.array as Float32Array).set(positions);(u.array as Float32Array).set(uvs);
 p.needsUpdate=u.needsUpdate=true;
 geometry.setDrawRange(0,positions.length/3);
 geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(extra/width/2,0,0),1+extra/width);
}
