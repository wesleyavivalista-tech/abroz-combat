import {isLowProfile} from '../../../../packages/game-core/simulation/DodoSystem.js';
import {FIRE_TRAIL_WIDTH,MAX_FIRE_TRAILS} from '../../../../packages/game-core/simulation/FireTrailSystem.js';
import { actors } from "../../../../packages/game-core/simulation/Actors.js";
import * as THREE from "three";
import type { SimulationSnapshot } from "../../../../packages/game-core/types.js";
import { characters } from "../../../../packages/game-core/characters/registry.js";
import { worldX } from "./StageCoordinates.js";
function flame() {
  return new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
    uniforms: { clock: {value: 0}, strength: {value: .8}, purple:{value:0} },
    vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec2 vUv; uniform float clock; uniform float strength; uniform float purple;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
      void main(){vec2 uv=floor(vUv*72.)/72.;float y=uv.y;
        float n=noise(vec2(uv.x*9.,y*7.-clock*4.))*.65+noise(vec2(uv.x*21.,y*17.-clock*7.))*.35;
        float edge=abs(uv.x-.5+sin(y*11.-clock*5.)*.035);
        float height=.58+.26*sin(uv.x*23.+clock*2.)+.13*sin(uv.x*41.-clock*3.);
        float density=(1.-y)*.72-edge*1.05+(n-.4)*.5;
        float shape=smoothstep(.06,.24,density)*smoothstep(height+.18,height-.12,y)*smoothstep(0.,.07,y);
        float core=clamp(density*1.8-y*.25,0.,1.);
        vec3 color=mix(vec3(1.,.11,.008),vec3(1.,.85,.26),core);
        if(purple>.5){
          // Tapered tongues and drifting embers, with transparent edges instead
          // of stretching one rectangular flame across the whole ground patch.
          float sway=sin(y*8.-clock*3.)*.06+sin(y*17.+clock*2.)*.025;
          float taper=mix(.43,.025,pow(y,.7));
          float tongue=1.-smoothstep(taper*.45,taper,abs(uv.x-.5+sway));
          float tip=.65+.2*noise(vec2(clock*1.7,uv.x*6.));
          shape=tongue*smoothstep(tip+.14,tip-.1,y)*smoothstep(0.,.045,y);
          shape*=.65+.35*n;
          core=pow(max(0.,1.-abs(uv.x-.5+sway)/max(taper,.01)),2.)*(1.-y);
          color=mix(vec3(.25,.015,.7),vec3(.74,.22,1.),core);
          color=mix(color,vec3(.91,.65,1.),core*core*.6);
          float emberY=fract(clock*.38+uv.x*7.);
          float ember=exp(-1800.*pow(uv.x-.5-sin(clock+uv.y*8.)*.23,2.)-1800.*pow(y-emberY,2.));
          shape=max(shape,ember*.65*y);
        }
        gl_FragColor=vec4(color*1.35,shape*strength); }
    `,
  }));
}
/** Broken, curling tongues around the silhouette, with a quiet center for readability. */
function bodyFire() {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1,1), new THREE.ShaderMaterial({
    transparent:true, depthWrite:false, toneMapped:false, side:THREE.DoubleSide,
    uniforms:{clock:{value:0},strength:{value:.8},aura:{value:0},purple:{value:0}},
    vertexShader:`varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`
      varying vec2 vUv; uniform float clock; uniform float strength; uniform float aura; uniform float purple;
      float hash(float x){return fract(sin(x*127.1)*43758.5453);}
      void main(){
        vec2 uv=floor(vUv*vec2(128.,160.))/vec2(128.,160.);
        float flame=0.; float heat=0.;
        for(int i=0;i<10;i++){
          float id=float(i), side=mod(id,2.)*2.-1.;
          float level=floor(id/2.);
          // Separate patches climb the legs and sides, never a solid cone over the face.
          float base=.045+level*.125+hash(id+7.)*.04;
          float center=.5+side*(.06+.2*hash(id+5.));
          float pulse=.5+.5*sin(clock*7.+id*2.4);
          float height=.065+.07*pulse+.035*aura;
          float y=(uv.y-base)/height;
          float bend=(sin(y*4.-clock*8.+id)*.044+sin(y*7.-clock*5.+id)*.008)*y;
          float width=(.024+.015*pulse+.009*aura)*pow(max(0.,1.-y),.72)*(.45+.55*sin(clamp(y,0.,1.)*3.14159));
          float distance=abs(uv.x-center-bend);
          float tongue=(1.-smoothstep(width*.6,width+.009,distance))*smoothstep(0.,.13,y)*(1.-smoothstep(.8,1.,y));
          float core=(1.-smoothstep(width*.15,width*.7,distance))*(1.-smoothstep(.15,.75,y));
          flame=max(flame,tongue*(.65+.35*pulse));heat=max(heat,tongue*core);
        }
        float sparks=0.;
        for(int i=0;i<10;i++){
          float id=float(i), phase=fract(clock*(.35+hash(id)*.22)+hash(id+9.));
          float x=.5+(hash(id+2.)-.5)*.64+sin(clock*3.+id)*.025;
          float y=.18+phase*.76;
          vec2 delta=(uv-vec2(x,y))/vec2(.007,.013);
          sparks=max(sparks,(1.-smoothstep(.25,1.,length(delta)))*sin(phase*3.14159));
        }
        vec3 color=mix(vec3(1.,.055,.002),vec3(1.,.46,.015),smoothstep(.3,.85,flame));
        color=mix(color,vec3(1.,.94,.53),smoothstep(.03,.4,heat));
        if(purple>.5){
          color=mix(vec3(.42,.025,1.),vec3(.85,.2,1.),smoothstep(.3,.85,flame));
          color=mix(color,vec3(.96,.78,1.),smoothstep(.03,.4,heat));
        }
        float alpha=max(smoothstep(.1,.75,flame)*.96,sparks*.95)*strength;
        if(alpha<.025)discard;
        gl_FragColor=vec4(mix(color,mix(vec3(1.,.79,.3),vec3(.8,.4,1.),purple),sparks)*1.35,alpha);
      }`,
  }));
  mesh.visible=false;
  return mesh;
}
function sigil() {
  const root = new THREE.Group();
  const material = new THREE.LineBasicMaterial({color: "#ff963c", transparent: true, opacity: .95, toneMapped: false, depthWrite: false});
  const circle = Array.from({length: 64}, (_, i) => new THREE.Vector3(Math.cos(i * Math.PI / 32), Math.sin(i * Math.PI / 32), 0));
  root.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(circle), material));
  const points = Array.from({length: 6}, (_, i) => {const angle = -Math.PI / 2 + i * Math.PI * 4 / 5; return new THREE.Vector3(Math.cos(angle) * .9, Math.sin(angle) * .9, 0);});
  root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material));
  const inner = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(circle.map(v => v.clone().multiplyScalar(.94))), material);
  root.add(inner); root.visible = false;
  return root;
}
/** Fixed pools: status visuals read only the restored simulation snapshot. */
export class FireEffects {
  root = new THREE.Group();
  private bodies = Array.from({length: 32}, bodyFire);
  private casts = Array.from({length: 8}, sigil);
  private trails:ReturnType<typeof flame>[]=[];
  private traps = Array.from({length: 64}, sigil);
  private shots = Array.from({length: 64}, () => {const group = new THREE.Group(); group.add(flame(), sigil()); return group;});
  constructor() { this.root.add(...this.bodies, ...this.casts, ...this.traps, ...this.shots); }
  update(s: SimulationSnapshot, menu: boolean): void {
    this.root.visible = !menu;
    const time = s.frame / 60;
    this.bodies.forEach(m => m.visible = false);
    this.casts.forEach(m => m.visible = false); this.traps.forEach(m => m.visible = false);
    actors(s).forEach(({fighter:f}, i) => {
      if(isLowProfile(f,s.frame))return;
      if (!f.lives || f.respawnAt || s.phase !== "fight") return;
      const x = worldX(f.x), y = f.y / 100;
      const aura = f.onFireUntil > s.frame;
      if (aura || f.burnUntil > s.frame) {
        const mesh=this.bodies[i];
        if(mesh){
          const low=["Crouch","CrouchingAttack","BlockCrouching","HitStunCrouching","GetUp","Land"].includes(f.state);
          const height=low?1.2: f.characterId==="tocha"?2.05:1.95;
          mesh.visible=true;mesh.position.set(x,y+height*.48,.22);mesh.scale.set(aura?1.65:1.4,height,1);
          mesh.material.uniforms.clock.value=time+i*1.73;
          mesh.material.uniforms.aura.value=aura?1:0;
          mesh.material.uniforms.purple.value=f.burnUntil>s.frame && f.burnKind==="purple"?1:0;
          const remaining=(aura?f.onFireUntil:f.burnUntil)-s.frame;
          mesh.material.uniforms.strength.value=(aura?1:.93)*Math.min(1,remaining/12);
        }
      }
      if (i >= 8 || f.characterId !== "tocha" || !f.move) return;
      const m = characters.tocha.moves[f.move];
      if (f.move === "satan" && f.moveFrame < m.startupFrames) {
        const g = this.casts[i]; g.visible = true; g.position.set(x, y + 1.8, .25);
        g.scale.setScalar(.3 + .6 * Math.min(1, f.moveFrame / 45)); g.rotation.z = Math.sin(time * 6) * .06;
      }

    });
    this.trails.forEach(m=>m.visible=false);
    let trailIndex=0,sigilIndex=0;
    s.hazards.forEach(h => {
      // Only fire hazards belong to this renderer; other typed hazards own their visuals.
      if(h.kind && h.kind!=='fire-trail')return;
      const groundBurn=!h.kind?characters[s.fighters[h.owner].characterId].moves[h.move].hazard:undefined;
      if(h.kind==='fire-trail'||groundBurn?.burn){
        const purple=groundBurn?.burn?.kind==='purple';
        const count=groundBurn?Math.ceil(groundBurn.radius*2/FIRE_TRAIL_WIDTH):1;
        const cell=groundBurn?groundBurn.radius*2/count:FIRE_TRAIL_WIDTH;
        for(let patch=0;patch<count;patch++){
          if(trailIndex>=MAX_FIRE_TRAILS+160)break;
          let mesh=this.trails[trailIndex];
          if(!mesh){mesh=flame();this.trails[trailIndex]=mesh;this.root.add(mesh);}
          trailIndex++;
          const x=groundBurn?h.x-groundBurn.radius+cell*(patch+.5):h.x;
          const height=purple?.72+.22*Math.sin(patch*2.4+h.owner):.5;
          mesh.visible=s.phase==='fight';mesh.position.set(worldX(x),h.y/100+(purple?height/2:.23),.18+(patch%2)*.015);
          mesh.scale.set(cell/100*1.35,height,1);
          mesh.material.uniforms.purple.value=purple?1:0;
          mesh.material.uniforms.clock.value=time+x*.017+h.owner;
          mesh.material.uniforms.strength.value=Math.min(1,(h.expiresAt-s.frame)/30);
        }
        return;
      }
      const i=sigilIndex++;
      const g = this.traps[i]; if (!g) return;
      g.visible = true; g.position.set(worldX(h.x), h.y / 100 + .025, .05);
      g.rotation.x = -Math.PI / 2; g.scale.setScalar(1.2);
      g.children.forEach(c => ((c as THREE.Line).material as THREE.LineBasicMaterial).opacity = Math.min(1, (h.expiresAt - s.frame) / 30) * (.8 + Math.sin(time * 8) * .15));
    });
    this.shots.forEach((g, i) => {
      const p = s.projectiles[i]; const spec = p?.active ? characters[s.fighters[p.owner].characterId].moves[p.move].projectile : undefined;
      g.visible = spec?.visual === "fire" || spec?.visual === "pentagram"; if (!g.visible) return;
      g.position.set(worldX(p.x), p.y / 100, .2);
      const f = g.children[0] as ReturnType<typeof flame>, star = g.children[1];
      f.visible = spec!.visual === "fire"; star.visible = !f.visible;
      f.rotation.z = p.vx < 0 ? -Math.PI / 2 : Math.PI / 2;
      f.scale.set(.8, 1.2, 1); f.material.uniforms.clock.value = time;
      star.scale.setScalar(.7); star.rotation.z = time * 3;
    });
  }
}
