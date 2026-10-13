import * as THREE from 'three';

/** Presentation only. One uniform set per fighter; no textures, meshes or simulation entities. */
export class FullEnergyEffect {
  readonly strength={value:0};
  readonly time={value:0};
  private patched=new WeakSet<THREE.Material>();

  update(root:THREE.Object3D,meter:number,dt:number,time:number,visible=true):void {
    const target=visible&&meter>=100?1:0;
    const step=Math.max(0,Math.min(dt,.1))/(target?.18:.28);
    this.strength.value=THREE.MathUtils.clamp(this.strength.value+(target?step:-step),0,1);
    this.time.value=time;
    root.traverse(o=>{
      if(!(o instanceof THREE.Mesh)||o.userData.environmentIgnore)return;
      for(const m of Array.isArray(o.material)?o.material:[o.material]){
        if(!(m instanceof THREE.MeshBasicMaterial)||!m.map||!m.transparent||m.blending!==THREE.NormalBlending||m.userData.environmentIgnore||this.patched.has(m))continue;
        this.patched.add(m);
        const previous=m.onBeforeCompile,key=m.customProgramCacheKey();
        m.onBeforeCompile=(shader,renderer)=>{
          previous.call(m,shader,renderer);
          shader.uniforms.fullEnergyStrength=this.strength;
          shader.uniforms.fullEnergyTime=this.time;
          shader.fragmentShader='uniform float fullEnergyStrength; uniform float fullEnergyTime;\n'+shader.fragmentShader;
          // Sample the current animated texture. Keep its alpha and all isolation/skin
          // shaders intact, so the soft luminous contour never reveals adjacent poses.
          shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
            #ifdef USE_MAP
            if(fullEnergyStrength>0.001){
              vec2 ex=dFdx(vMapUv)*3.0, ey=dFdy(vMapUv)*3.0;
              float edge=0.;
              edge+=1.-texture2D(map,vMapUv+ex).a;
              edge+=1.-texture2D(map,vMapUv-ex).a;
              edge+=1.-texture2D(map,vMapUv+ey).a;
              edge+=1.-texture2D(map,vMapUv-ey).a;
              edge+=1.-texture2D(map,vMapUv+ex+ey).a;
              edge+=1.-texture2D(map,vMapUv-ex-ey).a;
              edge+=1.-texture2D(map,vMapUv+ex-ey).a;
              edge+=1.-texture2D(map,vMapUv-ex+ey).a;
              edge=smoothstep(0.,.7,edge*.125);
              float pulse=.78+.22*sin(fullEnergyTime*3.4);
              // Sparse moving flecks along the contour, with no particle allocations.
              float fleck=pow(max(0.,sin(vMapUv.x*913.+vMapUv.y*571.-fullEnergyTime*4.)),28.);
              outgoingLight+=vec3(.48,.72,.85)*fullEnergyStrength*edge*(pulse*.65+fleck*.3);
            }
            #endif
            #include <opaque_fragment>`);
        };
        m.customProgramCacheKey=()=>key+'|full-energy-v1';
        m.needsUpdate=true;
      }
    });
  }
}
