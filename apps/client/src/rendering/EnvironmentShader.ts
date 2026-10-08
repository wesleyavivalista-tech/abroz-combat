import * as THREE from 'three';
import type {StageLighting,VisualQuality} from './StageLighting.js';
import {VisualLightPool} from './VisualLightPool.js';
export class EnvironmentShader {
 private patched=new WeakSet<THREE.Material>();
 readonly uniforms={envLamp:{value:new THREE.Vector4()},envAmbient:{value:new THREE.Color()},envKey:{value:new THREE.Color()},envRim:{value:new THREE.Color()},envTint:{value:new THREE.Color()},envParams:{value:new THREE.Vector4()},envStyle:{value:new THREE.Vector4()},envLightCount:{value:0},envLights:{value:[] as THREE.Vector4[]},envLightColors:{value:[] as THREE.Vector3[]}};
 update(c:StageLighting,q:VisualQuality,pool:VisualLightPool):void{
  const u=this.uniforms;u.envAmbient.value.set(c.ambientColor);u.envKey.value.set(c.mainLightColor);u.envRim.value.set(c.rimColor);u.envTint.value.set(c.tint);
  u.envParams.value.set(c.ambientIntensity*.25,q==='low'?0:c.shadingStrength,q==='high'?c.rimIntensity:0,c.mainLightDirection.x);
  u.envStyle.value.set(c.mainLightIntensity,c.tintStrength,q==='low'?0:1,0);u.envLightCount.value=pool.count;u.envLights.value=pool.positions;u.envLightColors.value=pool.colors;
 }
 apply(root:THREE.Object3D):void{
  root.traverseVisible(o=>{if(!(o instanceof THREE.Mesh)||o.userData.environmentIgnore)return;
   const materials=Array.isArray(o.material)?o.material:[o.material];
   for(const m of materials){
    if(!(m instanceof THREE.MeshBasicMaterial)||m.blending!==THREE.NormalBlending||m.userData.environmentIgnore)continue;
    // Sprite-only: lit arena meshes must retain their native lighting pipeline.
    if(m instanceof THREE.MeshBasicMaterial&&(!m.map||!m.transparent))continue;
    if(this.patched.has(m))continue;this.patched.add(m);
    const previous=m.onBeforeCompile,previousKey=m.customProgramCacheKey.bind(m),key=previousKey();const uniforms=this.uniforms;
    m.onBeforeCompile=(shader,renderer)=>{
     previous.call(m,shader,renderer);Object.assign(shader.uniforms,uniforms);
     shader.vertexShader='varying vec3 vEnvironmentWorld; varying float vEnvironmentSide;\n'+shader.vertexShader;
     shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
       vec4 envLocal=vec4(transformed,1.);
       #ifdef USE_INSTANCING
       envLocal=instanceMatrix*envLocal;
       #endif
       vEnvironmentWorld=(modelMatrix*envLocal).xyz;
       vEnvironmentSide=position.x*sign(modelMatrix[0][0]);`);
     shader.fragmentShader=`varying vec3 vEnvironmentWorld; varying float vEnvironmentSide;
       uniform vec4 envLamp;uniform vec3 envAmbient,envKey,envRim,envTint;uniform vec4 envParams,envStyle;
       uniform int envLightCount;uniform vec4 envLights[8];uniform vec3 envLightColors[8];\n`+shader.fragmentShader;
     shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
       float side=clamp(vEnvironmentSide*envParams.w,-.5,.5);
       vec3 light=mix(vec3(1.),envAmbient,envParams.x)+side*envParams.y*envKey*envStyle.x;
       outgoingLight*=clamp(light,vec3(.82),vec3(1.16));
       outgoingLight=mix(outgoingLight,outgoingLight*envTint,envStyle.y*.25);
       #ifdef USE_MAP
       if(envParams.z>0.){
        float a=texture2D(map,vMapUv+vec2(sign(envParams.w)*.003,0.)).a;
        float rim=clamp(diffuseColor.a-a,0.,1.);
        outgoingLight+=envRim*rim*envParams.z;
       }
       #endif
       // Shared fixture pools gently warm sprites near the existing lamps.
       float lampDistance=length(vec2(abs(vEnvironmentWorld.x)-envLamp.x,(vEnvironmentWorld.y-envLamp.y)*.45));
       float lamp=pow(max(0.,1.-lampDistance/max(.01,envLamp.z)),2.)*envLamp.w;
       outgoingLight+=envKey*lamp;
       vec3 dynamicGlow=vec3(0.);
       for(int i=0;i<8;i++){if(i>=envLightCount)break;vec4 l=envLights[i];float d=length(vEnvironmentWorld.xy-l.xy)/max(.01,l.z);float falloff=pow(max(0.,1.-d),2.);dynamicGlow+=envLightColors[i]*l.w*falloff;}
       outgoingLight+=min(dynamicGlow,vec3(.32))*envStyle.z;
       #include <opaque_fragment>`);
    };
    m.customProgramCacheKey=()=>key+'|environment-v3';m.needsUpdate=true;
   }
  });
 }
}
