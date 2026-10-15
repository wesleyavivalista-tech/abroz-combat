import * as THREE from 'three';

// Authored full-length hair, including one transparent pixel around the alpha bounds.
export const bodyHairArt = {path:'/art/bozo/body-hair-long-v1.png',width:1536,height:1024,left:35,top:485,right:1503,bottom:532} as const;

/** Reveal the pointed end of full-length artwork. World units per source pixel
 * stay constant throughout extension/retraction, in both axes; no stretched tiles. */
export class BozoBodyHair {
 readonly mesh:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;
 private texture:THREE.Texture;
 private rootFade={value:0};
 constructor(source:THREE.Texture){
  this.texture=source.clone();this.texture.needsUpdate=true;
  this.mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:this.texture,transparent:true,alphaTest:.2,toneMapped:false,side:THREE.DoubleSide}));
  this.mesh.material.onBeforeCompile=shader=>{
   shader.uniforms.hairRootFade=this.rootFade;
   shader.vertexShader='varying float hairRootU;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nhairRootU=uv.x;');
   shader.fragmentShader='varying float hairRootU; uniform float hairRootFade;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\ndiffuseColor.a*=smoothstep(0.0,hairRootFade,hairRootU);');
  };
  this.mesh.material.customProgramCacheKey=()=>'bozo-full-length-hair-v1';
  this.mesh.name='bozo-body-hair';this.mesh.visible=false;
 }
 /** The mesh is a child of the body sprite, so its attachment follows rigid pose motion. */
 update(left:number,bottom:number,width:number,height:number,bodyScale:number,pivot:number,seam:number,centerY:number,reach:number,shortTip:number,extension:number):void{
  const origin=(seam-pivot)*bodyScale;
  const fullLength=Math.max(.001,reach-origin);
  const shortLength=Math.min(fullLength,Math.max(0,(shortTip-seam)*bodyScale));
  const length=shortLength+(fullLength-shortLength)*THREE.MathUtils.clamp(extension,0,1);
  const pixelScale=fullLength/(bodyHairArt.right-bodyHairArt.left);
  const visiblePixels=length/pixelScale;
  this.texture.repeat.set(visiblePixels/bodyHairArt.width,(bodyHairArt.bottom-bodyHairArt.top)/bodyHairArt.height);
  this.texture.offset.set((bodyHairArt.right-visiblePixels)/bodyHairArt.width,1-bodyHairArt.bottom/bodyHairArt.height);
  // Compensate for the parent body's scale; the illustration itself remains uniform.
  this.mesh.scale.set(length/(width*bodyScale),(bodyHairArt.bottom-bodyHairArt.top)*pixelScale/(height*bodyScale),1);
  this.mesh.position.set((seam-left+length/bodyScale/2)/width-.5,(bottom-centerY)/height-.5,.001);
  this.rootFade.value=Math.min(1,.2/Math.max(.001,length));
  this.mesh.visible=true;
 }
 dispose():void{this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();this.texture.dispose();}
}
