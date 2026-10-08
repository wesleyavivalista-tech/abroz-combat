import * as THREE from 'three';
import {EnvironmentGuides} from './EnvironmentGuides.js';
import type {CombatEvent,Fighter,SimulationSnapshot,StageDefinition} from '../../../../packages/game-core/types.js';
import {characters} from '../../../../packages/game-core/characters/registry.js';
import {lightBeam} from '../../../../packages/game-core/simulation/LightBeamSystem.js';
import {arenaIlluminationFor,lightingFor,readVisualQuality,shadowProfile,visualPresets,visualShadowSurface,type StageLighting,type VisualQuality} from './StageLighting.js';
import {VisualLightPool,type VisualLightRequest} from './VisualLightPool.js';
import {EnvironmentShader} from './EnvironmentShader.js';
import type {FighterVisual} from './FighterRenderer.js';
const vertex='varying vec2 p;varying float worldX;void main(){p=uv;worldX=(modelMatrix*vec4(position,1.)).x;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
interface Shadow {mesh:THREE.Mesh<THREE.PlaneGeometry,THREE.ShaderMaterial>;used:boolean;surface:number;}
/** Owns cosmetics only. Snapshot access is read-only; timers are local render seconds. */
export class StageVisualEnvironment {
 get shadowCount():number{return this.shadows.size;}
 readonly root=new THREE.Group();readonly lights=new VisualLightPool();readonly shader=new EnvironmentShader();
 quality:VisualQuality=readVisualQuality();config:StageLighting;private geometryLighting:ReturnType<typeof arenaIlluminationFor>;
 private shadows=new Map<string,Shadow>();private geometry=new THREE.PlaneGeometry(1,1);private previousFrame=-1;
 private dustGeometry=new THREE.BufferGeometry();
 private dustMaterial=new THREE.PointsMaterial({color:'#eadbc2',size:.035,transparent:true,opacity:.08,depthWrite:false});
 private dust=new THREE.Points(this.dustGeometry,this.dustMaterial);
 private debugPanel?:HTMLPreElement;private guides?:EnvironmentGuides;private guideX=0;private guideFloor=0;private debugAt=0;
 // Fixed, shadowless lights use Three's native material pipeline. Never alter the base lights.
 readonly arenaLights=Array.from({length:2},()=>new THREE.PointLight('#ffffff',0,1,2));
 constructor(stage:StageDefinition){this.config=lightingFor(stage);this.geometryLighting=arenaIlluminationFor(stage,this.config.geometry);this.root.name='visual-environment';for(const light of this.arenaLights){light.castShadow=false;this.root.add(light);}const points=new Float32Array(64*3);for(let i=0;i<64;i++){points[i*3]=(i*7.73%28)-14;points[i*3+1]=i*1.97%10;points[i*3+2]=-3-(i%3)*.2;}this.dustGeometry.setAttribute('position',new THREE.BufferAttribute(points,3));this.dust.renderOrder=-1;this.root.add(this.dust);}
 configure(stage:StageDefinition,overrides:Partial<StageLighting>={}):void{this.config=lightingFor(stage,overrides);this.geometryLighting=arenaIlluminationFor(stage,this.config.geometry);this.reset();}
 /** Standard material lighting never shares the sprite shader or depends on quality. */
 applyStageLights(scene:THREE.Scene):void{
  const c=this.geometryLighting;
  const sky=scene.getObjectByName('arena-sky') as THREE.HemisphereLight;
  const key=scene.getObjectByName('arena-key') as THREE.DirectionalLight;
  const rim=scene.getObjectByName('arena-rim') as THREE.DirectionalLight;
  const fill=scene.getObjectByName('arena-fill') as THREE.PointLight;
  sky.color.set(c.sky);sky.groundColor.set(c.ground);sky.intensity=c.skyIntensity;
  key.color.set(c.key);key.intensity=c.keyIntensity;key.position.set(c.direction.x,c.direction.y,c.direction.z);
  rim.color.set(c.rim);rim.intensity=c.rimIntensity;fill.color.set(c.fill);fill.intensity=c.fillIntensity;
 }
 setQuality(value:VisualQuality):void{this.quality=value;try{localStorage.setItem('abroz-visual-quality',value);}catch{/* storage unavailable */}if(value==='low'){this.lights.clear();for(const light of this.arenaLights)light.intensity=0;}}
 spawnDynamicLight(request:VisualLightRequest):void{if(this.config.dynamicLighting&&this.quality!=='low')this.lights.spawn(request);}
 consume(events:readonly CombatEvent[]):void{
  for(const e of events)if(e.type!=='attack'&&(e.power>=3||e.type==='fire-hit'&&e.power>=2))this.spawnDynamicLight({id:e.id,x:e.x,y:e.y,radius:Math.min(600,180+e.power*50),intensity:.25+Math.min(5,e.power)*.045,color:e.type==='fire-hit'?'#ff8739':e.type==='block'?'#99dfff':'#ffdc9b',duration:.18,priority:e.power});
 }
 begin(s:SimulationSnapshot,stage:StageDefinition,dt:number,cameraX:number,menu:boolean):void{
  this.guideX=cameraX;this.guideFloor=stage.floorHeight/100;
  if(s.frame<this.previousFrame||menu||s.phase!=='fight')this.lights.clear();this.previousFrame=s.frame;
  this.dust.visible=!menu&&this.quality==='high'&&this.config.dust>0;this.dustMaterial.opacity=this.config.dust;this.dust.position.set(Math.sin(s.frame*.002)*.15,stage.floorHeight/100+Math.sin(s.frame*.001)*.10,0);
  for(const v of this.shadows.values()){v.used=false;v.mesh.visible=false;}
  if(!menu&&s.phase==='fight'&&this.quality!=='low'&&this.config.dynamicLighting){
   // Meaningful continuous beams use existing synchronized state, never new events.
   s.fighters.forEach((f,i)=>{
    if(f.lives<=0||f.respawnAt>0)return;const ray=lightBeam(f,stage.width,stage.floorHeight);if(!ray||ray.water)return;
    this.lights.spawn({id:`beam-${i}`,x:Math.max(0,Math.min(stage.width,ray.x+ray.dx*250)),y:ray.y+ray.dy*250,radius:450,intensity:.36,color:f.characterId==='drupa'?'#fff1a6':'#bce6ff',duration:.08,priority:4},true);
   });
   for(const w of s.foreheadWaves??[])if(w.meteor&&s.frame-w.born<18)this.lights.spawn({id:`meteor-${w.owner}-${w.born}`,x:w.x,y:w.y,radius:650,intensity:.6,color:'#ffd49a',duration:.28,priority:8});
   for(const p of s.projectiles){if(!p.active)continue;const owner=s.fighters[p.owner],move=characters[owner?.characterId]?.moves[p.move];if(!move||!owner||!characters[owner.characterId].superButtons.includes(p.move))continue;
    if(!['fire','pentagram','cannonball'].includes(move.projectile?.visual??''))continue;
    this.lights.spawn({id:`projectile-${p.owner}-${p.serial}`,x:p.x,y:p.y,radius:260,intensity:.22,color:'#ff9653',duration:.08,priority:2},true);
   }
  }
  this.lights.update(dt,this.config.dynamicLighting?visualPresets[this.quality].lights:0,cameraX*100+stage.width/2,stage.width,this.config.dynamicMultiplier);
  this.shader.update(this.config,this.quality,this.lights);
  this.shader.uniforms.envLamp.value.set(stage.theme==='church'?8:12.7,stage.floorHeight/100,4,this.quality==='low'?0:.045);
  for(let i=0;i<this.arenaLights.length;i++){
   const light=this.arenaLights[i],p=this.lights.positions[i],color=this.lights.colors[i];
   // Keep light count constant to avoid recompiling stage shaders during combat.
   light.intensity=i<this.lights.count&&this.quality!=='low'?Math.min(1.2,p.w*3):0;
   light.position.set(p.x,p.y+.6,.9);light.distance=Math.max(1,p.z);
   light.color.setRGB(color.x,color.y,color.z);
  }
 }
 shadow(id:string,f:Pick<Fighter,'x'|'y'|'undead'>,visual:Pick<FighterVisual,'root'|'shadow'>,stage:StageDefinition,s:SimulationSnapshot,opacity=1):void{
  const visible=visual.root.visible&&(visual.shadow?.visible??true)&&f.undead!=='dying';
  if(visual.shadow)visual.shadow.visible=false;
  if(!visible)return;
  let entry=this.shadows.get(id);if(!entry){
   const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,uniforms:{shade:{value:.3},contact:{value:.1},softness:{value:.6},limits:{value:new THREE.Vector2(-100,100)},debug:{value:0}},vertexShader:vertex,fragmentShader:'varying vec2 p;varying float worldX;uniform vec2 limits;uniform float shade,contact,softness,debug;void main(){if(worldX<limits.x||worldX>limits.y)discard;vec2 q=(p-.5)*2.;float d=length(q);float soft=1.-smoothstep(mix(.65,.08,softness),1.,d);float foot=exp(-dot(q*vec2(2.,1.5),q*vec2(2.,1.5))*5.);gl_FragColor=vec4(mix(vec3(.055,.065,.085),vec3(.2,.75,1.),debug),min(.65,soft*(shade+debug*.3)+foot*contact));}'});
   const mesh=new THREE.Mesh(this.geometry,material);mesh.userData.environmentIgnore=true;mesh.rotation.x=-Math.PI/2;mesh.renderOrder=1;this.root.add(mesh);entry={mesh,used:true,surface:0};this.shadows.set(id,entry);
  }
  entry.used=true;const receiver=visualShadowSurface(stage,f.x,f.y,s.structures),surface=receiver.height,profile=shadowProfile(f.y-surface,this.config,this.quality);entry.surface=surface;
  const mesh=entry.mesh;mesh.visible=true;mesh.position.set(f.x/100-stage.width/200+profile.offset,surface/100+.026,.04);
  mesh.scale.set(1.05*profile.size*profile.stretch,.85*profile.size,1);
  mesh.material.uniforms.limits.value.set(receiver.left/100-stage.width/200,receiver.right/100-stage.width/200);
  mesh.material.uniforms.shade.value=profile.opacity*opacity;mesh.material.uniforms.contact.value=profile.contact*opacity;mesh.material.uniforms.softness.value=profile.softness;
 }
 finish(debug:boolean,renderer:THREE.WebGLRenderer):void{
  for(const [id,v] of this.shadows)if(!v.used){this.root.remove(v.mesh);v.mesh.material.dispose();this.shadows.delete(id);}
  for(const v of this.shadows.values())v.mesh.material.uniforms.debug.value=debug?1:0;
  if(debug){
   if(!this.guides){this.guides=new EnvironmentGuides();this.root.add(this.guides.root);}
   this.guides.root.visible=true;this.guides.update(this.lights.positions,this.lights.count,this.guideX,this.guideFloor,this.config.mainLightDirection);
  }else if(this.guides)this.guides.root.visible=false;
  if(debug&&typeof document!=='undefined'){
   if(!this.debugPanel){this.debugPanel=document.createElement('pre');this.debugPanel.id='visual-environment-debug';Object.assign(this.debugPanel.style,{position:'fixed',left:'8px',bottom:'8px',zIndex:'1000',color:'#fff',background:'#071019dd',fontSize:'11px',maxWidth:'360px',maxHeight:'42vh',overflow:'auto',pointerEvents:'auto'});document.body.append(this.debugPanel);}
   if(performance.now()<this.debugAt)return;this.debugAt=performance.now()+250;
   this.debugPanel.textContent=JSON.stringify({nativeLights:this.arenaLights.filter(l=>l.intensity>0).length,shadowCount:this.shadows.size,preset:this.quality,lights:this.lights.count,budget:visualPresets[this.quality].lights,mainDirection:this.config.mainLightDirection,shadowDirection:this.config.shadowDirection,surfaces:[...this.shadows].map(([id,s])=>[id,s.surface]),radii:this.lights.positions.slice(0,this.lights.count).map(v=>v.z),drawCalls:renderer.info.render.calls,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,settings:this.config,geometryLighting:this.geometryLighting},null,1);
  }else{this.debugPanel?.remove();this.debugPanel=undefined;}
 }
 reset():void{this.lights.clear();for(const light of this.arenaLights)light.intensity=0;if(this.guides)this.guides.root.visible=false;for(const v of this.shadows.values()){this.root.remove(v.mesh);v.mesh.material.dispose();}this.shadows.clear();}
 dispose():void{this.reset();this.guides?.dispose();this.geometry.dispose();this.dustGeometry.dispose();this.dustMaterial.dispose();this.debugPanel?.remove();this.root.removeFromParent();}
}
