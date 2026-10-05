import { worldX } from "./StageCoordinates.js";
import * as THREE from "three";
import type { CombatEvent } from "../../../../packages/game-core/types.js";
interface Particle {
  mesh: THREE.Mesh;
  life: number;
  duration: number;
  vx: number;
  vy: number;
  vz: number;
}
interface Burst {
  mesh: THREE.Mesh;
  life: number;
  power: number;
}
export class EffectManager {
  root = new THREE.Group();
  pool: Particle[] = [];
  bursts: Burst[] = [];
  healing: {root:THREE.Group;life:number}[] = [];
  constructor() {
    for(let i=0;i<12;i++){
      const root=new THREE.Group();root.visible=false;
      for(let n=0;n<5;n++){
        const plus=new THREE.Group();const material=new THREE.MeshBasicMaterial({color:n===0?'#e4fff0':'#4dff9a',transparent:true,depthWrite:false,toneMapped:false});
        plus.add(new THREE.Mesh(new THREE.PlaneGeometry(.10,.34),material),new THREE.Mesh(new THREE.PlaneGeometry(.34,.10),material));
        plus.position.set(n===0?0:Math.cos(n*Math.PI/2)*.52,n===0?.4:Math.sin(n*Math.PI/2)*.38,.04);
        root.add(plus);
      }
      const ring=new THREE.Mesh(new THREE.RingGeometry(.62,.67,48),new THREE.MeshBasicMaterial({color:'#50ffa2',transparent:true,opacity:.7,depthWrite:false,toneMapped:false,side:THREE.DoubleSide}));
      root.add(ring);this.root.add(root);this.healing.push({root,life:0});
    }
    const geometry = new THREE.OctahedronGeometry(0.045);
    for (let i = 0; i < 180; i++) {
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({
          color: "#e4ffb4",
          transparent: true,
          depthWrite: false,
          toneMapped: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      mesh.visible = false;
      this.root.add(mesh);
      this.pool.push({ mesh, life: 0, duration: 0, vx: 0, vy: 0, vz: 0 });
    }
    for (let i = 0; i < 12; i++) {
      const mesh = new THREE.Mesh(
        new THREE.RingGeometry(0.36, 0.4, 40),
        new THREE.MeshBasicMaterial({
          color: "#e9ffd0",
          transparent: true,
          depthWrite: false,
          toneMapped: false,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
        }),
      );
      mesh.visible = false;
      this.root.add(mesh);
      this.bursts.push({ mesh, life: 0, power: 1 });
    }
  }
  spawn(event: CombatEvent): void {
    if (event.type === "attack") return;
    if (event.type === 'heal') {
      const heal=this.healing.find(h=>h.life<=0)??this.healing[0];heal.root.userData.player=event.player;heal.life=1.1;heal.root.visible=true;
      heal.root.position.set(worldX(event.x),event.y/100,.45);heal.root.scale.setScalar(1);
      return;
    }
    const dust = event.type.includes("dust");
    const count = dust ? 9 : 14 + event.power * 5;
    if (!dust) {
      const burst = this.bursts.find((b) => b.life <= 0);
      if (burst) {
        burst.mesh.userData.player=event.player;
        burst.life = 0.22;
        burst.power = event.power;
        burst.mesh.position.set(worldX(event.x), event.y / 100, 0.4);
        burst.mesh.visible = true;
        burst.mesh.scale.setScalar(0.2);
        (burst.mesh.material as THREE.MeshBasicMaterial).color.set(
          event.type === "block" ? "#a5eaff" : "#fff3ad",
        );
      }
    }
    let n = 0;
    for (const p of this.pool) {
      if (p.life > 0) continue;
      p.mesh.userData.player=event.player;
      p.life = p.duration = dust ? 0.5 : 0.28;
      p.mesh.visible = true;
      p.mesh.position.set(worldX(event.x), dust ? Math.max(0.08, event.y / 100 - 0.85) : event.y / 100, 0.3);
      const angle = n * 2.399;
      p.vx = Math.cos(angle) * (2 + event.power);
      p.vy = Math.sin(angle) * (2 + event.power) + (dust ? 1 : 0);
      p.vz = Math.sin(n) * 0.5;
      p.mesh.rotation.z = angle;
      p.mesh.scale.set(dust ? 3 : 7, dust ? 1.1 : 0.3, 1);
      (p.mesh.material as THREE.MeshBasicMaterial).color.set(
        event.type === "fire-hit" ? "#ff7530" : event.type === "block" ? "#95e8ff" : dust ? "#b5a18b" : "#fff1ac",
      );
      if (++n >= count) break;
    }
  }
  hidePlayers(players:number[]):void{
    for(const p of this.pool)if(players.includes(p.mesh.userData.player)){p.life=0;p.mesh.visible=false;}
    for(const p of this.bursts)if(players.includes(p.mesh.userData.player)){p.life=0;p.mesh.visible=false;}
    for(const p of this.healing)if(players.includes(p.root.userData.player)){p.life=0;p.root.visible=false;}
  }
  update(dt: number): void {
    for(const heal of this.healing){
      if(heal.life<=0)continue;heal.life=Math.max(0,heal.life-dt);heal.root.visible=heal.life>0;
      const progress=1-heal.life/1.1;heal.root.position.y+=dt*.55;heal.root.scale.setScalar(1+progress*.2);
      heal.root.traverse(node=>{if(node instanceof THREE.Mesh)(node.material as THREE.MeshBasicMaterial).opacity=Math.min(1,heal.life/.45);});
    }
    for (const p of this.pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.mesh.visible = p.life > 0;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.vy -= 4 * dt;
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0,
        p.life / p.duration,
      );
    }
    for (const b of this.bursts) {
      if (b.life <= 0) continue;
      b.life -= dt;
      b.mesh.visible = b.life > 0;
      b.mesh.scale.setScalar(0.25 + (1 - b.life / 0.22) * b.power * 0.9);
      (b.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0,
        b.life / 0.22,
      );
    }
  }
}
