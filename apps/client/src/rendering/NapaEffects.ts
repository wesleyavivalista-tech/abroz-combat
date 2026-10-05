import * as THREE from 'three';
import type {SimulationSnapshot} from '../../../../packages/game-core/types.js';
import {characters} from '../../../../packages/game-core/characters/registry.js';
import {NAPA,monsterSpawnX} from '../../../../packages/game-core/simulation/NapaSystem.js';
import {worldX,renderStage} from './StageCoordinates.js';
import {createFighterVisual} from './VisualRegistry.js';
import type {FighterVisual} from './FighterRenderer.js';
function cookieTexture(){const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d')!;x.fillStyle='#60381c';x.beginPath();x.arc(64,64,58,0,Math.PI*2);x.fill();x.fillStyle='#d99b4e';x.beginPath();x.arc(64,61,54,0,Math.PI*2);x.fill();x.fillStyle='#f4c77b';x.beginPath();x.arc(61,57,49,0,Math.PI*2);x.fill();for(let i=0;i<15;i++){const a=i*2.4,r=10+(i%4)*10;x.fillStyle=i%2?'#492716':'#754222';x.beginPath();x.ellipse(64+Math.cos(a)*r,62+Math.sin(a)*r,5,7,a,0,Math.PI*2);x.fill();}const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
/** Fixed pools, tick-based visuals: replaying a frame reproduces its summon and particles. */
export class NapaEffects{
 root=new THREE.Group();private texture=cookieTexture();private cookies:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>[]=[];private crumbs:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>[]=[];private slime:THREE.Mesh<THREE.PlaneGeometry,THREE.ShaderMaterial>[]=[];private births=new Map<number,FighterVisual>();
 constructor(){
  for(let i=0;i<128;i++){const m=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:this.texture,transparent:true,depthWrite:false,toneMapped:false}));this.cookies.push(m);this.root.add(m);}
  for(let i=0;i<192;i++){const m=new THREE.Mesh(new THREE.PlaneGeometry(.08,.08),new THREE.MeshBasicMaterial({color:i%3?0xe7b469:0x58311e,transparent:true,depthWrite:false,toneMapped:false}));this.crumbs.push(m);this.root.add(m);}
  for(let i=0;i<8;i++){const m=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.ShaderMaterial({transparent:true,depthWrite:false,toneMapped:false,uniforms:{clock:{value:0}},vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec2 v;uniform float clock;void main(){vec2 p=(v-.5)*2.;float edge=1.-p.x*p.x;float wave=.10*sin(p.x*19.+clock*2.)+.06*sin(p.x*37.-clock);float mask=1.-smoothstep(edge*.7+wave,edge+wave,abs(p.y));mask*=1.-smoothstep(.94,1.,abs(p.x));vec3 color=mix(vec3(.12,.34,.015),vec3(.56,.83,.11),v.y);float bubbles=pow(max(0.,sin(p.x*34.+sin(clock*1.6))*sin(v.y*20.+clock*2.)),18.);gl_FragColor=vec4(color+bubbles*.3,mask*.9);}` }));this.slime.push(m);this.root.add(m);}
 }
 update(s:SimulationSnapshot,menu:boolean){
  this.root.visible=!menu&&s.phase==='fight';this.cookies.forEach(m=>m.visible=false);this.crumbs.forEach(m=>m.visible=false);this.slime.forEach(m=>m.visible=false);this.births.forEach(v=>v.root.visible=false);
  if(!this.root.visible)return;let ci=0,pi=0,si=0;
  const cookie=(x:number,y:number,size:number,spin=0)=>{const m=this.cookies[ci++];if(!m)return;m.visible=true;m.position.set(worldX(x),y/100,.3);m.scale.setScalar(size);m.rotation.z=spin;};
  const burst=(x:number,y:number,age:number,count:number,spread=1)=>{for(let i=0;i<count;i++){const m=this.crumbs[pi++];if(!m)break;const a=i*2.4,speed=(.025+(i%5)*.009)*spread;m.visible=true;m.position.set(worldX(x)+Math.cos(a)*speed*age,y/100+.12+Math.abs(Math.sin(a))*speed*age-age*age*.0008,.32);m.rotation.z=age*.13+i;m.material.color.setHex(i%3?0xe7b469:0x58311e);m.material.opacity=Math.max(0,1-age/45);m.scale.setScalar(1+i%3);}};
  for(const p of s.projectiles)if(p.active&&characters[s.fighters[p.owner].characterId].moves[p.move]?.projectile?.visual==='cookie')cookie(p.x,p.y,p.move==='bossCookie'?.6:.4,s.frame*.16);
  for(const h of s.hazards){
   if(h.kind==='cookie-drop')cookie(h.x,h.y+15,.32,Math.sin(s.frame*.04)*.12);
   if(h.kind==='cookie-crumbs')burst(h.x,h.y+90,s.frame-(h.createdAt??s.frame),24,2);
   if(h.kind==='snot'){const m=this.slime[si++];if(!m)continue;m.visible=true;m.position.set(worldX(h.x),h.y/100+(h.height??NAPA.snotHeight)/200,.18);m.scale.set((h.width??NAPA.snotWidth)/100,(h.height??NAPA.snotHeight)/100*1.6,1);m.material.uniforms.clock.value=s.frame/60;}
  }
  s.fighters.forEach((f,i)=>{
   if(f.characterId!=='napa')return;
   if(f.move==='cookieMonster'&&f.moveFrame>=30&&f.moveFrame<95)for(let j=0;j<8;j++){const m=this.crumbs[pi++];if(!m)break;const t=((s.frame+j*5)%30)/30;m.visible=true;m.material.color.setHex(j%2?0xffd272:0xff9c35);m.material.opacity=(1-t)*.9;m.position.set(worldX(f.x+f.facing*(f.moveFrame>=75?95:55)) + Math.sin(j*2.4)*.16,f.y/100+(f.moveFrame>=75?1.53:1.24)+t*.35,.3);m.scale.setScalar(.4+(1-t)*.4);m.rotation.z=s.frame*.08+j;}
   if(f.move==='cookieMonster'&&f.moveFrame>=115&&f.moveFrame<180){const age=f.moveFrame-115,x=monsterSpawnX(f,renderStage);
    if(age<35)cookie(x,f.y+14+age*.7,.35+age*.024,Math.sin(age*.6)*.15);
    if(age>=25){const reveal=Math.min(1,(age-25)/40);let v=this.births.get(i);if(!v){v=createFighterVisual(characters.napa,'cookie-monster');this.births.set(i,v);this.root.add(v.root);}v.update({...f,x,move:null,state:'Idle',cookieBoss:true},s.frame/60);v.root.visible=true;v.root.scale.set(f.facing*(.2+reveal*.8),Math.max(.02,reveal),1);burst(x,f.y,age-25,12,1.5);}
   }
   if(f.move==='bossSlam')return;
   if(f.move==='sniff'&&f.moveFrame>=18&&f.moveFrame<108)for(let j=0;j<20;j++){const m=this.crumbs[pi++];if(!m)break;const t=((s.frame+j*7)%35)/35,angle=j*Math.PI*2/20,radius=.8+3.4*(1-t);m.visible=true;m.material.color.setHex(0xdce9e5);m.material.opacity=(1-t)*.65;m.position.set(worldX(f.x)+Math.cos(angle)*radius,Math.max(.08,f.y/100+1.35+Math.sin(angle)*radius),.22);m.rotation.z=angle;m.scale.set(3,.3,1);}
   if(f.move==='sneeze'&&f.moveFrame>=45&&f.moveFrame<65){const m=this.slime[si++];if(m){m.visible=true;const t=(f.moveFrame-45)/20;m.position.set(worldX(f.x+f.facing*(40+t*180)),f.y/100+1.3*(1-t),.25);m.scale.set(1.2+t*1.5,.9,1);m.material.uniforms.clock.value=s.frame/60;}}
  });
  for(const c of s.clones)if(c.kind==='cookie-monster'&&c.fighter.move==='bossSlam'&&c.fighter.moveFrame>=48&&c.fighter.moveFrame<78)burst(c.fighter.x+c.fighter.facing*130,c.fighter.y,c.fighter.moveFrame-48,18,2);
 }
 dispose(){this.texture.dispose();this.births.forEach(v=>v.dispose());this.births.clear();}
}
