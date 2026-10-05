import * as THREE from "three";
import {buildChurchArena} from "./ChurchArena.js";
import {buildMallArena} from "./MallArena.js";
import {platformX} from "../../../../packages/game-core/stages/motion.js";
import {arenaFloorMap,addDeckFinish} from "./ArenaFinish.js";
import {arenaMaterial, batchArenaBoxes} from "./ArenaMaterials.js";
import { trainingRoom } from "../../../../packages/game-core/stages/registry.js";
import type {StageDefinition} from "../../../../packages/game-core/types.js";


/** Distinct urban arenas; all decoration stays outside collision logic. */
export class StageRenderer {
  private disposed=false;
  private movingDecks:THREE.Group[]=[];
  root = new THREE.Group();
  ready: Promise<void>;
  constructor(public definition:StageDefinition=trainingRoom) {
    const arenaWidth=definition.width/100;
    const basketball=definition.theme==='basketball', mall=definition.theme==='mall', church=definition.theme==='church';
    this.root.position.y=definition.floorHeight/100;
    this.ready = new THREE.TextureLoader().loadAsync(definition.artwork ?? "/art/rooftop-city-v1.png").then(texture => {
      if(this.disposed){texture.dispose();return;}
      texture.colorSpace = THREE.SRGBColorSpace;
      const skyline = new THREE.Mesh(new THREE.PlaneGeometry(church ? 32 : basketball||mall ? 40 : 52, church ? 18 : basketball||mall ? 22.5 : 29.25),
        new THREE.MeshBasicMaterial({ map: texture, fog: false, toneMapped: false }));
      skyline.position.set(0, church ? 5.4 : basketball||mall ? 8 : 6, -9);
      this.root.add(skyline);
    });
    if(church){buildChurchArena(this.root,definition);return;}
    if(mall){this.movingDecks=buildMallArena(this.root,definition);this.update(0);return;}
    const concrete = arenaMaterial(basketball ? "#294653" : "#76746b", "stone", 3);
    const steel = arenaMaterial("#333d43", "metal", 2);
    const white = arenaMaterial("#e7dfca", "paint");
    const terracotta = arenaMaterial(basketball ? "#dc713c" : "#b5a071", "paint", 3);
    const box = (x: number, y: number, z: number, w: number, h: number, d: number, material: THREE.Material) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      mesh.position.set(x, y, z); mesh.receiveShadow = true; mesh.castShadow = true;
      this.root.add(mesh); return mesh;
    };
    const texture = arenaFloorMap(basketball?'basketball':'rooftop');
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(50, 9),
      new THREE.MeshStandardMaterial({map: texture, roughness: 0.96}));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.01; floor.receiveShadow = true; this.root.add(floor);
    box(0, -1.6, 3.5, 50, 3.1, 1, concrete);
    box(0, -0.12, 3.4, 50, 0.24, 1.1, concrete);
    // Layered coping, recessed masonry joints and a dark underside frame the arena.
    box(0,-.28,3.99,50,.11,.08,steel);
    box(0,.58,-3.5,50,.10,.48,terracotta);
    for(let x=-24;x<=24;x+=2){
      box(x,-.95,4.015,.025,1.25,.018,steel);
      box(x+.72,-.38,4.025,.32,.035,.025,terracotta);
      box(x,.28,-3.305,.02,.48,.015,steel);
    }
    box(0,-1.6,4.015,50,.025,.02,steel);
    if(basketball){
    for (const z of [-1.6, 1.6]) box(0, 0.005, z, arenaWidth, 0.012, 0.05, white);
    for (const x of [-arenaWidth/2, 0, arenaWidth/2]) box(x, 0.005, 0, 0.055, 0.012, 3.2, white);
    const courtRing = new THREE.Mesh(new THREE.RingGeometry(1.35, 1.4, 64), white);
    courtRing.rotation.x = -Math.PI / 2; courtRing.position.y = 0.009; this.root.add(courtRing);
    }
    if(basketball){
      const orangePaint=arenaMaterial("#bd603f", "paint", 2);
      for(const side of [-1,1])box(side*(arenaWidth/2-2),.002,0,4,.003,2.3,orangePaint);
      // Hoops and painted keys sit behind the combat lane, with no collision bodies.
      for(const side of [-1,1]){
        const x=side*(arenaWidth/2-1.2);
        box(x,1.8,-2.65,.12,3.6,.12,steel);
        box(x,3.5,-2.15,1.9,1.15,.1,white);
        box(x,3.25,-2.08,.75,.055,.02,terracotta);
        for(const dx of [-.375,.375])box(x+dx,3.48,-2.08,.035,.48,.02,terracotta);
        box(x,3.72,-2.08,.75,.035,.02,terracotta);
        const rim=new THREE.Mesh(new THREE.TorusGeometry(.38,.035,8,32),terracotta);
        rim.rotation.x=Math.PI/2;rim.position.set(x,3.02,-1.65);this.root.add(rim);
        const net:number[]=[];
        for(let i=0;i<12;i++){const a=i*Math.PI/6;net.push(x+Math.cos(a)*.38,3.02,-1.65+Math.sin(a)*.38,x+Math.cos(a+.25)*.22,2.5,-1.65+Math.sin(a+.25)*.22);}
        const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(net,3));this.root.add(new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:'#e7dfca'})));
        for(const z of [-1.15,1.15])box(side*(arenaWidth/2-2),.012,z,4,.016,.045,white);
        box(side*(arenaWidth/2-4),.012,0,.045,.016,2.3,white);
      }
    }
    // Rear parapet and chain-link fence remain behind the fighters.
    box(0, 0.28, -3.5, 50, 0.56, 0.35, concrete);
    if(basketball){
    for (let x = -24; x <= 24; x += 2) box(x, 1.2, -3.5, 0.045, 1.8, 0.045, steel);
    box(0, 2.1, -3.5, 50, 0.04, 0.04, steel);
    const fenceVertices: number[] = [];
    for (let x = -25; x < 25; x += 0.25) {
      fenceVertices.push(x, 0.55, -3.5, x + 1.55, 2.1, -3.5);
      fenceVertices.push(x, 2.1, -3.5, x + 1.55, 0.55, -3.5);
    }
    const fence = new THREE.BufferGeometry(); fence.setAttribute("position", new THREE.Float32BufferAttribute(fenceVertices, 3));
    this.root.add(new THREE.LineSegments(fence, new THREE.LineBasicMaterial({color: "#738083", transparent: true, opacity: 0.32})));
    }else {
      // Low safety rail leaves the rooftop skyline open.
      box(0,.9,-3.5,50,.07,.07,steel);
      for(let x=-24;x<=24;x+=3)box(x,.57,-3.5,.065,.65,.065,steel);
    }
    // Arena decks, with unchanged playable top surfaces.
    for (const [index,platform] of (definition.platforms ?? []).entries()) {
      const x = (platform.x + platform.width / 2)/100-arenaWidth/2, y = (platform.y-definition.floorHeight) / 100, width = platform.width / 100;
      box(x, y - 0.12, 0, width, 0.24, 1.5, concrete);
      box(x, y - 0.055, 0.76, width, 0.065, 0.035, terracotta);
      if(!basketball)for(const dx of [-width/2+.22,width/2-.22])box(x+dx,y-.12,.79,.32,.09,.02,terracotta);
      else {const glow=new THREE.MeshBasicMaterial({color:'#71ddd4'});box(x,y-.15,.79,width,.035,.02,glow);}
      box(x, y - 0.21, 0.76, width, 0.045, 0.035, white);
      addDeckFinish(this.root,x,y,width,basketball?'basketball':'rooftop',index);
      // Recessed support beam and gussets sit entirely beneath the playable top.
      box(x,y-.31,-.05,width-.16,.16,1.22,steel);
      for(const dx of [-width/2+.12,width/2-.12]){
        box(x+dx,y-.13,.79,.12,.22,.055,steel);
        const brace=box(x+dx*.7,y-.57,-.67,.10,.85,.10,steel);
        brace.rotation.z=dx<0?-.65:.65;
      }
      for(let dx=-width/2+.35;dx<width/2;dx+=.7)
        box(x+dx,y-.30,.58,.055,.14,.065,terracotta);

      for (const dx of [-width / 2 + 0.25, width / 2 - 0.25]) {
        box(x + dx, y / 2 - 0.12, -0.68, 0.15, y - 0.24, 0.15, steel);
        box(x + dx, 0.06, -0.68, 0.42, 0.12, 0.42, concrete);
      }
      for (let dx = -width / 2 + 0.1; dx < width / 2; dx += 0.6)
        box(x + dx, y - 0.14, 0.785, 0.025, 0.025, 0.01, steel);
    }
    // Everyday rooftop props beyond the combat plane.
    for (const x of basketball?[]:[-10, 10]) {
      box(x, 0.62, -2.9, 1.4, 1.1, 0.8, concrete);
      for (let y = 0.22; y < 1.1; y += 0.1) box(x, y, -2.48, 1.18, 0.035, 0.025, steel);
      box(x, 1.2, -2.9, 1.5, 0.08, 0.9, steel);
    }
    if(!basketball){
      for(const x of [-6,7]){
        box(x,.25,-2.9,1.5,.5,.65,steel);
        box(x,.55,-2.9,1.7,.12,.85,concrete);
      }
      for(const x of [-3,3])box(x,.045,2.7,1.1,.06,.45,steel);
    }
    if(!basketball){
      // Conduits, vent collars and drain slots give the roof a maintained industrial history.
      box(0,.09,-2.15,18,.07,.07,steel);
      for(const x of [-9,-5,0,5,9])box(x,.09,-2.15,.12,.13,.18,terracotta);
      for(const x of [-3,3])for(let dx=-.45;dx<=.45;dx+=.12)
        box(x+dx,.079,2.7,.045,.015,.35,concrete);
      for(const x of [-10,10]){
        box(x,.1,-2.9,1.65,.18,1,steel);
        box(x-.58,.64,-2.465,.065,.98,.025,terracotta);
        box(x+.58,.64,-2.465,.065,.98,.025,terracotta);
        box(x+.35,.92,-2.44,.22,.10,.018,white);
      }
    }else{
      // Sideline benches and padded hoop bases make this a neighborhood sports ground.
      for(const x of [-7.8,7.8]){
        for(const z of [-2.55,-2.75,-2.95])box(x,.48,z,2.1,.09,.15,terracotta);
        for(const dx of [-.8,.8])box(x+dx,.24,-2.75,.09,.48,.42,steel);
        for(const y of [.82,1.04])box(x,y,-3.02,2.1,.16,.08,terracotta);
      }
      for(const side of [-1,1]){
        box(side*10.8,.58,-2.65,.34,1.1,.32,concrete);
        box(side*10.8,.85,-2.475,.20,.055,.015,terracotta);
      }
    }
    for (const x of [-13, 13]) {
      box(x, 3.5, -2, 0.1, 7, 0.1, steel);
      box(x, 6.85, -1.9, 0.75, 0.2, 0.3, steel);
      const lamp=basketball?new THREE.MeshBasicMaterial({color:'#d5f1ff'}):white;
      box(x, 6.79, -1.72, basketball?1.4:.63, .1, .04, lamp);
      if(basketball)for(const dx of [-.48,0,.48])box(x+dx,6.85,-1.68,.38,.26,.1,lamp);
    }
    batchArenaBoxes(this.root);
  }
  dispose():void{
    this.disposed=true;
    const geometries=new Set<THREE.BufferGeometry>(), materials=new Set<THREE.Material>(), textures=new Set<THREE.Texture>();
    this.root.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.LineSegments){
      geometries.add(o.geometry);
      for(const m of (Array.isArray(o.material)?o.material:[o.material])){
        materials.add(m);
        for(const value of Object.values(m))if(value instanceof THREE.Texture)textures.add(value);
      }
      if(o instanceof THREE.InstancedMesh)o.dispose();
    }});
    textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());
    this.root.clear();
  }
  update(tick: number): void {
    this.movingDecks.forEach((deck,i)=>{const p=this.definition.platforms![i];deck.position.x=(platformX(p,tick)+p.width/2-this.definition.width/2)/100;});
  }
}
