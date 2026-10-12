import {StageVisualEnvironment} from './StageVisualEnvironment.js';
import {visualPresets,type VisualQuality} from './StageLighting.js';
import {createEnvironmentPost} from './EnvironmentPost.js';
import {renderStage} from './StageCoordinates.js';
import {loadZombieSprites} from './ZombieSpriteRenderer.js';
import {UndeadVisuals} from './UndeadVisuals.js';
import {FINAL_DEATH_FRAMES,finalDeathActive} from '../../../../packages/game-core/simulation/UndeadSystem.js';
import {stageAtTick} from "../../../../packages/game-core/stages/motion.js";
import {animationTick} from './AnimationPlayback.js';
import {NikalzEffects} from './NikalzEffects.js';
import {EideEffects} from './EideEffects.js';
import {FinanceEffects} from './FinanceEffects.js';
import {mountableKnight} from '../../../../packages/game-core/simulation/JopaSystem.js';
import {JopaEffects} from './JopaRenderer.js';
import {AstolfoEffects} from './AstolfoEffects.js';
import {FaustoEffects} from './FaustoEffects.js';
import {NapaEffects} from './NapaEffects.js';
import {dodoCompanions} from './DodoCompanionPresentation.js';
import {lowProfileOpacity} from './LowProfileVisual.js';
import {isLowProfile} from '../../../../packages/game-core/simulation/DodoSystem.js';
import {DodoEffects} from './DodoEffects.js';
import {StructureEffects} from '../characters/luizinho/StructureEffects.js';
import {trainingRoom} from '../../../../packages/game-core/stages/registry.js';
import {debugGeometry} from '../../../../packages/game-core/combat/DebugGeometry.js';
import {RomsEffects} from './RomsEffects.js';
import {BloodEffects} from './BloodEffects.js';
import {StunEffects} from './StunEffects.js';
import { SpearProjectiles } from './SpearProjectiles.js';
import { HairCloneGrowth } from "./HairCloneGrowth.js";
import { HairEffects } from "./HairEffects.js";
import { FireEffects } from "./FireEffects.js";
import { worldX, arenaWidth, cameraBounds, withRenderStage } from "./StageCoordinates.js";
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { type FighterVisual } from "./FighterRenderer.js";
import { createFighterVisual, loadFighterSprites } from "./VisualRegistry.js";
import { StageRenderer } from "./StageRenderer.js";
import { EffectManager } from "./EffectManager.js";
import { characters } from "../../../../packages/game-core/characters/registry.js";
import type {
  SimulationSnapshot,
  CombatEvent,
} from "../../../../packages/game-core/types.js";
export class SceneRenderer {
  private observer:ResizeObserver;
  environment=new StageVisualEnvironment(trainingRoom);
  private bloom=new UnrealBloomPass(new THREE.Vector2(1280,720),.1,.5,.9);
  private atmosphere=createEnvironmentPost();
  renderer: THREE.WebGLRenderer;
  composer: EffectComposer;
  scene = new THREE.Scene();
  spectatorTarget?:number;
  camera = new THREE.PerspectiveCamera(35, 16 / 9, 0.1, 80);
  stage = new StageRenderer();
  mountLabels:(string|undefined)[]=[];
  effects = new EffectManager();
  blood = new BloodEffects();
  roms = new RomsEffects();
  structures = new StructureEffects();
  dodo = new DodoEffects();
  jopa = new JopaEffects();
  finance = new FinanceEffects();
  eide = new EideEffects();
  nikalz = new NikalzEffects();
  napa = new NapaEffects();
  fausto = new FaustoEffects();
  astolfo = new AstolfoEffects();
  fire = new FireEffects();
  stunEffects = new StunEffects();
  hair = new HairEffects();
  spears = new SpearProjectiles();
  cloneGrowth = new HairCloneGrowth();
  private undead = new UndeadVisuals();
  clones = new Map<number, FighterVisual>();
  private cloneIdentities = new Map<number,string>();
  fighters: FighterVisual[] = [];
  ids = "";
  ready = Promise.resolve();
  async prepareFighters(ids?:readonly string[]): Promise<void> {
    await Promise.all([loadFighterSprites(ids),loadZombieSprites(ids)]);
    if(!ids||ids.includes("luizinho"))await this.structures.load();
    this.ids = "";
  }
  debug = false;
  shake = 0;
  projectiles: THREE.Mesh[] = [];
  debugBoxes: THREE.LineSegments[] = [];
  shields: THREE.Group[] = [];
  constructor(canvas: HTMLCanvasElement) {
    void this.ready.catch(() => {});
    void this.stage.ready.catch(() => {});
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.info.autoReset=false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.scene.background = new THREE.Color("#6c747e");
    this.scene.fog = new THREE.Fog("#776c61", 13, 30);
    this.scene.add(
      this.environment.root,
      this.stage.root,
      this.effects.root,
      this.fire.root,
      this.blood.root,
      this.roms.root,
      this.structures.root,
      this.dodo.root,
      this.hair.root,
      this.spears.root,
      Object.assign(new THREE.HemisphereLight("#c9d4e0", "#645347", 1.3), {name:"arena-sky"}),
    );
    const key = new THREE.DirectionalLight("#ffe0b4", 2.7);
    key.name="arena-key";
    key.position.set(-3, 6, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.normalBias = .025;
    key.shadow.radius = 2;
    Object.assign(key.shadow.camera, {
      left: -arenaWidth / 2 - 3,
      right: arenaWidth / 2 + 3,
      top: 8,
      bottom: -8,
    });
    this.scene.add(key);
    const rim = new THREE.DirectionalLight("#b6c9e2", 1.4);
    rim.name="arena-rim";
    rim.position.set(3, 4, -4);
    this.scene.add(rim);
    const orange = new THREE.PointLight("#ffd3a1", 6, 16);
    orange.name="arena-fill";
    orange.position.set(6, 3, 1);
    this.scene.add(orange);
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(this.bloom);
    this.composer.addPass(this.atmosphere);
    this.composer.addPass(new OutputPass());
    this.camera.position.set(0, 3.4, 12);
    this.camera.lookAt(0, 1.25, 0);
    for (let i = 0; i < 64; i++) {
      const mesh = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.23, 1),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(2.5, 3.4, 1.3),
          toneMapped: false,
        }),
      );
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 12, 8),
        new THREE.MeshBasicMaterial({
          color: "#b4ed8a",
          transparent: true,
          opacity: 0.22,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      mesh.add(halo);
      const orbit = new THREE.Mesh(
        new THREE.TorusGeometry(0.3, 0.018, 6, 28),
        new THREE.MeshBasicMaterial({ color: "#ecffbb", toneMapped: false }),
      );
      orbit.rotation.x = 0.7;
      mesh.add(orbit);
      mesh.visible = false;
      this.scene.add(mesh);
      this.projectiles.push(mesh);
    }
    for (let i = 0; i < 8; i++) {
      const shield = new THREE.Group();
      const shell = new THREE.Mesh(
        new THREE.SphereGeometry(1, 24, 16),
        new THREE.MeshBasicMaterial({
          color: "#a6f3ff",
          transparent: true,
          opacity: 0.12,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      shell.scale.set(0.65, 1, 0.42);
      shield.add(shell);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1, 0.018, 6, 48),
        new THREE.MeshBasicMaterial({
          color: "#a6f3ff",
          transparent: true,
          opacity: 0.8,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          toneMapped: false,
        }),
      );
      ring.scale.x = 0.65;
      shield.add(ring);
      shield.visible = false;
      this.scene.add(shield);
      this.shields.push(shield);
    }
    for (let i = 0; i < 42; i++) {
      const mesh = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 0.05)),
        new THREE.LineBasicMaterial({ color: "#ff596f", depthTest: false }),
      );
      mesh.renderOrder = 999;
      mesh.visible = false;
      this.scene.add(mesh);
      this.debugBoxes.push(mesh);
    }
    this.observer=new ResizeObserver(() => this.resize());
    this.observer.observe(canvas.parentElement!);
    this.setVisualQuality(this.environment.quality);
  }
  setVisualQuality(value:VisualQuality):void{
    this.environment.setQuality(value);this.effects.particleDensity=visualPresets[value].particles;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,visualPresets[value].dpr));
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.renderer.shadowMap.enabled=value==='high';this.resize();
  }
  dispose():void{
    this.environment.dispose();
    this.undead.dispose();this.scene.remove(this.undead.root);
    this.cloneGrowth.dispose();this.scene.remove(this.cloneGrowth.root);
    this.observer.disconnect();this.stage.dispose();this.structures.dispose();this.napa.dispose();this.jopa.dispose();this.finance.dispose();this.eide.dispose();this.nikalz.dispose();this.fausto.dispose();this.astolfo.dispose();
    this.fighters.forEach(f=>f.dispose());this.clones.forEach(f=>f.dispose());
    this.scene.traverse(o=>{
      if(o instanceof THREE.Mesh||o instanceof THREE.LineSegments){o.geometry.dispose();const materials=Array.isArray(o.material)?o.material:[o.material];materials.forEach(m=>m.dispose());}
      if(o instanceof THREE.DirectionalLight)o.shadow.dispose();
    });
    for(const pass of this.composer.passes)pass.dispose();
    this.composer.dispose();this.renderer.dispose();this.scene.clear();
  }
  resize(): void {
    const canvas = this.renderer.domElement;
    // Zoom/fullscreen/display changes can change pixel density after initialization.
    const pixelRatio = Math.min(devicePixelRatio, visualPresets[this.environment.quality].dpr);
    if (this.renderer.getPixelRatio() !== pixelRatio) {
      this.renderer.setPixelRatio(pixelRatio);
      this.composer.setPixelRatio(pixelRatio);
    }
    this.renderer.setSize(
      canvas.parentElement!.clientWidth,
      canvas.parentElement!.clientHeight,
      false,
    );
    this.composer.setSize(
      canvas.parentElement!.clientWidth,
      canvas.parentElement!.clientHeight,
    );
    this.camera.aspect = canvas.clientWidth / canvas.clientHeight;
    this.camera.updateProjectionMatrix();
  }
  consume(events: CombatEvent[]): void {
    this.environment.consume(events);
    events.forEach((e) => {
      this.effects.spawn(e);
      if (e.power >= 3) this.shake = 0.07;
    });
  }
  syncCloneVisuals(s:SimulationSnapshot,menu:boolean,cosmeticTime?:number):void{
    for(const [id,visual] of this.clones) if(!s.clones.some(c=>c.id===id&&this.cloneIdentities.get(id)===`${c.fighter.characterId}:${c.kind}:${c.variant}`)) {
      this.scene.remove(visual.root);if(visual.shadow)this.scene.remove(visual.shadow);visual.dispose();this.clones.delete(id);this.cloneIdentities.delete(id);
    }
    for(const c of s.clones){
      if(c.undead)continue;
      let v=this.clones.get(c.id);
      if(!v){v=createFighterVisual(characters[c.fighter.characterId],c.kind==='blonde'?`blonde-${c.variant??0}`:c.kind==='sad'||c.kind==='angry'?c.kind+(s.skins[c.owner]==='casual'?'-casual':''):c.kind==='basketball'?`pain-killer-${c.variant}`:c.fighter.jopaSummon??(c.kind==='cookie-monster'?'cookie-monster':'hair-clone'));this.clones.set(c.id,v);this.cloneIdentities.set(c.id,`${c.fighter.characterId}:${c.kind}:${c.variant}`);this.scene.add(v.root);if(v.shadow)this.scene.add(v.shadow);}
      v.update(c.fighter,cosmeticTime??animationTick(c.fighter)/60,s.frame);v.root.visible=!menu&&s.phase==="fight";if(v.shadow)v.shadow.visible=v.root.visible;
    }
  }
  draw(s: SimulationSnapshot, dt: number, time: number, menu = false, stageDefinition=trainingRoom,cosmeticTime?:number): void {
    withRenderStage(stageAtTick(stageDefinition,s.platformTick??0),()=>{
    if(this.stage.definition!==stageDefinition){
      this.environment.configure(stageDefinition);
      this.scene.remove(this.stage.root);this.stage.dispose();this.stage=new StageRenderer(stageDefinition);this.scene.add(this.stage.root);void this.stage.ready.catch(()=>{});
    }
    const ids = s.fighters.map((f, i) => `${f.characterId}:${s.skins[i]}`).join();
    if (ids !== this.ids) {
      this.environment.reset();
      this.fighters.forEach((f) => {
        this.scene.remove(f.root);
        if (f.shadow) this.scene.remove(f.shadow);
        f.dispose();
      });
      this.fighters = s.fighters.map((f, i) =>
        createFighterVisual(characters[f.characterId], s.skins[i]),
      );
      this.fighters.forEach((f) => {
        this.scene.add(f.root);
        if (f.shadow) this.scene.add(f.shadow);
      });
      this.ids = ids;
    }
    this.shields.forEach((shield) => (shield.visible = false));
    this.fighters.forEach((visual, i) => {
      let fighter = s.fighters[i];
      const death=s.finalDeaths?.find(d=>d.seat===i&&s.frame<d.frame+FINAL_DEATH_FRAMES);
      if(death)fighter={...fighter,x:death.x,y:death.y,lives:1,health:1,state:"HitStunStanding",move:null};
      const holder=s.fighters[fighter.grappleOwner];
      const gymWeight=fighter.state==='Grappled'&&holder?.characterId==='jomp'&&holder.move==='gymBro';
      visual.update(gymWeight?{...fighter,state:'Idle',move:null}:["HairTrapped","Grappled"].includes(fighter.state) ? {...fighter, state:"HitStunStanding"} : fighter, cosmeticTime??animationTick(fighter)/60,s.frame);
      if (fighter.trappedUntil > s.frame) visual.root.rotation.z = Math.sin(s.frame*.25+i)*.018;
      else visual.root.rotation.z = fighter.dazed && fighter.stun ? Math.sin(s.frame*.12)*.025 : 0;
      if(gymWeight){
        visual.root.rotation.z=-holder.facing*Math.PI/2;
        visual.root.updateMatrixWorld(true);
        const bounds=new THREE.Box3();
        visual.root.traverseVisible(object=>{if(object instanceof THREE.Mesh)bounds.expandByObject(object);});
        const center=bounds.getCenter(new THREE.Vector3());
        visual.root.position.x+=worldX(fighter.x)-center.x;
        visual.root.position.y+=fighter.y/100-center.y;
        if(visual.shadow)visual.shadow.visible=false;
      }
      
      const stealthOpacity=fighter.characterId==='dodo'?lowProfileOpacity(fighter,s.frame):1;
      if(fighter.characterId==='dodo'){visual.root.traverse(object=>{if(object instanceof THREE.Mesh){const materials=Array.isArray(object.material)?object.material:[object.material];for(const material of materials)material.opacity=stealthOpacity;}});if(visual.shadow)(visual.shadow.material as THREE.Material).opacity=.25*stealthOpacity;}
      const hidden=stealthOpacity===0||fighter.characterId==='caio'&&((fighter.move==='vanish'&&fighter.moveFrame>=5)||(fighter.state.startsWith('Dash')&&fighter.stateFrame>=3&&fighter.stateFrame<=9));
      visual.root.visible = !hidden && !menu && fighter.respawnAt === 0 && fighter.lives > 0;
      if (visual.shadow)
        visual.shadow.visible = visual.root.visible && !gymWeight && fighter.jopaRide===undefined && fighter.jopaTree===undefined;
      const shield = this.shields[i];
      shield.visible =
        visual.root.visible &&
        s.frame < fighter.invulnerableUntil &&
        s.phase === "fight";
      shield.position.set(worldX(fighter.x), fighter.y / 100 + 0.9, 0.1);
      shield.scale.setScalar(1 + Math.sin(time * 8) * 0.035);
    });
    this.syncCloneVisuals(s,menu,cosmeticTime);
    if(!this.undead.root.parent)this.scene.add(this.undead.root);this.undead.update(s,menu);
    if(!this.cloneGrowth.root.parent)this.scene.add(this.cloneGrowth.root);
    this.cloneGrowth.update(s,menu,time);
    this.hair.update(s, menu);
    this.spears.update(s, menu);
    this.fire.update(s, menu);
    this.blood.update(s,menu);
    this.roms.update(s,menu);
    this.structures.update(s,menu);
    if(!this.nikalz.root.parent)this.scene.add(this.nikalz.root);this.nikalz.update(s,menu);
    this.dodo.update(s,menu);
    if(!this.napa.root.parent)this.scene.add(this.napa.root);
    this.napa.update(s,menu);
    if(!this.jopa.root.parent)this.scene.add(this.jopa.root);
    this.jopa.update(s,menu);
    if(!this.finance.root.parent)this.scene.add(this.finance.root);
    this.finance.update(s,menu);
    if(!this.eide.root.parent)this.scene.add(this.eide.root);this.eide.update(s,menu);
    if(!this.fausto.root.parent)this.scene.add(this.fausto.root);
    this.fausto.update(s,menu);
    if(!this.astolfo.root.parent)this.scene.add(this.astolfo.root);
    this.astolfo.update(s,menu);
    if(!this.stunEffects.root.parent)this.scene.add(this.stunEffects.root);
    this.stunEffects.update(s,menu);
    this.stage.update(s.platformTick??0);
    this.effects.hidePlayers(s.fighters.flatMap((f,i)=>isLowProfile(f,s.frame)?[i]:[]));
    this.effects.update(dt);
    const target=this.spectatorTarget===undefined?undefined:s.fighters[this.spectatorTarget];
    const survivors = (target&&target.lives>0?[target]:s.fighters.filter((f) => f.lives > 0)).map(f=>f.meteorStart===undefined?f:{...f,y:f.meteorY??stageDefinition.floorHeight});
    const entrance=!menu&&(s.fighters.some(f=>f.move==='love')||s.clones.some(c=>c.kind==='blonde'&&c.fighter.health>0&&c.fighter.npcEntrance));
    const tracked = [...(survivors.length ? survivors : [{x:stageDefinition.width/2,y:stageDefinition.floorHeight}]),...(entrance?[{x:24,y:stageDefinition.floorHeight},{x:stageDefinition.width-24,y:stageDefinition.floorHeight},...s.clones.filter(c=>c.kind==='blonde'&&c.fighter.health>0).map(c=>c.fighter)]:[])];
    const left = Math.min(...tracked.map((f) => f.x));
    const right = Math.max(...tracked.map((f) => f.x));
    const mid = worldX((left + right) / 2);
    const distance = (right - left) / 100;
    const arenaHeight=stageDefinition.theme!=='rooftop'?Math.max(0,...(stageDefinition.platforms??[]).map(p=>p.y-stageDefinition.floorHeight)):0;
    const height = Math.max(arenaHeight,...tracked.map((f) => f.y-stageDefinition.floorHeight)) / 100;
    let targetX = menu
      ? 0
      : Math.max(cameraBounds[0], Math.min(cameraBounds[1], mid));
    let targetZ = menu
      ? 12.8
      : Math.max(
          13.5,
          (distance / 2 + Math.abs(mid - targetX) + 2) /
            (Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) *
              this.camera.aspect),
          height * 1.5 + (stageDefinition.theme==='church'?12.9:stageDefinition.theme==='mall'?11:stageDefinition.theme==='basketball'?9:7),
        );
    const deaths=!menu&&finalDeathActive(s)?s.finalDeaths!.filter(d=>s.frame<d.frame+FINAL_DEATH_FRAMES):[];
    const deathY=deaths.length?deaths.reduce((sum,d)=>sum+d.y,0)/deaths.length/100+1:undefined;
    if(deaths.length){targetX=worldX(deaths.reduce((sum,d)=>sum+d.x,0)/deaths.length);const span=(Math.max(...deaths.map(d=>d.x))-Math.min(...deaths.map(d=>d.x)))/100;targetZ=Math.max(8,(span/2+2)/(Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2))*this.camera.aspect));}
    const smoothing = 1 - Math.exp(-dt * (deaths.length?35:5));
    this.camera.position.x += (targetX - this.camera.position.x) * smoothing;
    this.camera.position.z += (targetZ - this.camera.position.z) * smoothing;
    this.camera.position.y = stageDefinition.floorHeight/100 + 3.15 + height * 0.18 + (stageDefinition.theme==='mall'?.5:0);
    const fog = this.scene.fog as THREE.Fog;
    fog.near = this.camera.position.z + 1;
    fog.far = this.camera.position.z + 18;
    this.camera.lookAt(targetX, deathY??stageDefinition.floorHeight/100 + (menu ? 1.0 : stageDefinition.theme==='mall'?2.6:2.1) + height * 0.25, 0);
    this.camera.updateMatrixWorld();
    this.blood.updateCamera(this.camera);
    const tags = document.getElementById("player-tags");
    if (tags) {
      const colors = [
        "#c9ec7a",
        "#ffb18e",
        "#7adfff",
        "#dbadff",
        "#ffdf70",
        "#ff83ba",
        "#6ef0bd",
        "#b4c4ff",
      ];
      tags.innerHTML = s.fighters
        .map((f, i) => {
          if (isLowProfile(f,s.frame) || f.lives === 0 || f.respawnAt > 0 || (f.move === "vanish" && f.moveFrame >= 5)) return "";
          const point = new THREE.Vector3(
            worldX(f.x),
            f.y / 100 + 2.15*(f.weaponUntil?characters[f.characterId].weaponModifiers?.bodyScale??1:1),
            0,
          ).project(this.camera);
          return `<span class="player-tag" style="left:${(point.x + 1) * 50}%;top:${(1 - point.y) * 50}%;color:${s.teamMatch ? ["#7adfff", "#ff8575"][s.teams[i]] : colors[i]}">P${i + 1}${f.beeBoxes ? ` · BEE BOXES ${f.beeBoxes}/5` : (f.beeSlowUntil??0)>s.frame ? ' · SLOWED 30%' : (f.loanUntil??0)>s.frame ? `<strong class="loan-indicator">LOAN<small>${Math.ceil((f.loanUntil!-s.frame)/60)}s · ENERGY LOCKED</small></strong>` : f.loveMode&&!f.weaponUntil ? ' · LOVE MODE' : f.stampAttempts!==undefined ? ` · LOAN STAMPS ${f.stampAttempts}/5` : (f.angelUntil??0)>s.frame ? ` · MMORPG BIEL ${Math.ceil((f.angelUntil!-s.frame)/60)}s` : (f.movementSlowUntil??0)>s.frame ? ` · SLOWED 20%` : (f.talkUntil??0)>s.frame ? ` · A GREAT IDEA ${Math.ceil((f.talkUntil!-s.frame)/60)}s` : (f.talkSlow??1)<1 ? ` · TALK SLOW ${Math.round((1-f.talkSlow!)*100)}%` : (f.sadnessUntil??0)>s.frame ? ` · SADNESS ${Math.ceil((f.sadnessUntil!-s.frame)/60)}s` : (f.angerUntil??0)>s.frame ? ` · BRAVINHO ${Math.ceil((f.angerUntil!-s.frame)/60)}s · ${f.angerStacks??0} HITS · +${20+5*(f.angerStacks??0)}%` : (f.cloudSlow??1)<1 ? ` · SLOWED 40%` : f.bloodMasterUntil>s.frame ? ` · BLOOD MASTER ${Math.ceil((f.bloodMasterUntil-s.frame)/60)}s` : f.areaSlow<1 || f.bloodSlowUntil>s.frame ? ` · SLOWED ${f.areaSlow===.1?90:50}%` : f.poisonUntil>s.frame ? ` · POISON ${Math.ceil((f.poisonUntil-s.frame)/60)}s` : f.weaponUntil>s.frame ? ` · ${characters[f.characterId].weaponModifiers?.label??"SPEAR"} ${Math.ceil((f.weaponUntil-s.frame)/60)}s` : f.grappleUntil>s.frame ? ` · GRABBED ${Math.ceil((f.grappleUntil-s.frame)/60)}s` : f.trappedUntil>s.frame ? ` · TRAPPED ${Math.ceil((f.trappedUntil-s.frame)/60)}s` : f.armorUntil>s.frame ? ` · ARMOR ${Math.ceil((f.armorUntil-s.frame)/60)}s` : ""}${s.teamMatch ? ` · ${["BLUE", "RED"][s.teams[i]]}` : ""}</span>`;
        })
        .join("") + s.clones.filter(c=>!c.undead).map(c=>{
          const point=new THREE.Vector3(worldX(c.fighter.x),c.fighter.y/100+(c.fighter.jopaSummon==="tree"?3.65:c.fighter.jopaSummon==="knight"?3.05:1.85),0).project(this.camera);
          return `<span class="player-tag" style="left:${(point.x+1)*50}%;top:${(1-point.y)*50}%;color:#d5b18c">P${c.owner+1} ${c.kind==='blonde'?`BLONDE ${(c.variant??0)+1}`:c.kind==='basketball'?`#${dodoCompanions[c.variant??0]?.number}`:c.fighter.jopaSummon?c.fighter.jopaSummon.toUpperCase():c.kind==='cookie-monster'?'COOKIE MONSTER':c.kind==='sad'?'SAD ASTOLFO':c.kind==='angry'?'ANGRY ASTOLFO':'HAIR'} · ${c.fighter.health}${c.maxHealth?`<progress max="${c.maxHealth}" value="${c.fighter.health}" aria-label="${c.fighter.jopaSummon??(c.kind==='blonde'?`Blonde ${(c.variant??0)+1}`:c.kind==='cookie-monster'?'Cookie Monster':c.kind==='sad'?'Sad Astolfo':c.kind==='angry'?'Angry Astolfo':'Pain Killer')} health" style="display:block;width:56px;height:7px"></progress>`:''}</span>`;
        }).join("") + (s.structures??[]).filter(b=>b.phase!=="collapsed"&&b.kind!=="bee-box").map(b=>{
          const point=new THREE.Vector3(worldX(b.x),(b.y+(b.phase==='marked'?35:b.height+35))/100,.3).project(this.camera);
          return `<span class="player-tag" style="left:${(point.x+1)*50}%;top:${(1-point.y)*50}%;color:#84d6ef">P${b.owner+1} · ${b.phase==='marked'?'APPROVED · PRESS ULTIMATE 2 TO BUILD':b.kind.toUpperCase()+' · '+b.health+'/'+b.maxHealth}${b.expiresAt?' · '+Math.ceil((b.expiresAt-s.frame)/60)+'s':''}</span>`;
        }).join("");
    }
    if(tags&&!menu&&s.phase==='fight')tags.innerHTML+=s.fighters.map((f,i)=>{
      const label=this.mountLabels[i];if(!label||!mountableKnight(s,stageDefinition,i))return '';
      const point=new THREE.Vector3(worldX(f.x),f.y/100+2.75,0).project(this.camera);
      return `<span class="player-tag mount-tip" style="left:${(point.x+1)*50}%;top:${(1-point.y)*50}%">Press <kbd>${label}</kbd> to mount</span>`;
    }).join('');
    if(tags&&!menu)tags.innerHTML+=s.fighters.map((f,i)=>(f.lowProfileNoticeUntil??0)>s.frame?`<span class="low-profile-notice" style="top:${27+i*5}%">P${i+1} · LOW-PROFILE</span>`:'').join('');
    const foreheadShake=Math.max(0,...(s.foreheadWaves??[]).map(w=>{const age=s.frame-w.born;const duration=w.meteor?42:16;return age<duration?(w.meteor?.48:.065)*(1-age/duration):0;}));
    this.camera.position.y += Math.cos(s.frame*2.2)*foreheadShake;
    this.camera.position.x += Math.sin(time * 91) * Math.max(this.shake,foreheadShake);
    this.shake *= 0.82;
    this.projectiles.forEach((mesh, i) => {
      const p = s.projectiles[i];
      mesh.visible = !!p?.active && !p.trajectory && !p.jopaKind && characters[s.fighters[p.owner].characterId].moves[p.move].financeAbility!=='feathers' && !characters[s.fighters[p.owner].characterId].moves[p.move].projectile?.visual;
      if (p?.active) {
        mesh.position.set(worldX(p.x), p.y / 100, 0.1);
        mesh.rotation.z = time * 8;
        const superMove = characters[
          s.fighters[p.owner].characterId
        ].superButtons.includes(p.move);
        mesh.scale.set(
          superMove ? 3.2 : 1.7,
          superMove ? 1.4 : 1,
          superMove ? 1.4 : 1,
        );
      }
    });
    this.debugBoxes.forEach((m) => (m.visible = false));
    if (this.debug) {
      let n = 0;
      const colors={hurt:'#79caff',hit:'#ff527a',push:'#c9ec7a',beam:'#57eeff',projectile:'#ffd36c',area:'#c085ff',grab:'#ff9955'};
      for(const b of debugGeometry(s,stageAtTick(stageDefinition,s.platformTick??0))){
        let mesh=this.debugBoxes[n++];
        if(!mesh){mesh=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1,1,.05)),new THREE.LineBasicMaterial({depthTest:false}));mesh.renderOrder=999;this.debugBoxes.push(mesh);this.scene.add(mesh);}
        mesh.visible=true;mesh.position.set(worldX(b.x+b.w/2),(b.y+b.h/2)/100,.6);mesh.scale.set(b.w/100,b.h/100,1);mesh.rotation.z=b.angle??0;
        (mesh.material as THREE.LineBasicMaterial).color.set(colors[b.kind]);
      }
    }
    const env=this.environment,c=env.config;
    env.begin(s,renderStage,dt,this.camera.position.x,menu);
    env.applyStageLights(this.scene);
    fog.color.set(c.fogColor);fog.far=this.camera.position.z+c.fogDistance;
    this.fighters.forEach((v,i)=>{env.shader.apply(v.root);env.shadow('fighter-'+i,s.fighters[i],v,renderStage,s,s.fighters[i].characterId==='dodo'?lowProfileOpacity(s.fighters[i],s.frame):1);});
    for(const clone of s.clones){const v=this.clones.get(clone.id);if(v){env.shader.apply(v.root);env.shadow('clone-'+clone.id,clone.fighter,v,renderStage,s);}}
    this.undead.forEachGrave((id,root)=>{const clone=s.clones.find(c=>c.id===id);if(clone)env.shadow('grave-'+id,clone.fighter,{root},renderStage,s);});
    for(const b of s.structures??[])if(b.phase==='built'&&b.health>0)env.shadow('structure-'+b.id,{x:b.x,y:b.y},{root:this.structures.root},renderStage,s,.65);
    this.undead.forEachFighter((id,v)=>{const clone=s.clones.find(c=>c.id===id);if(clone)env.shadow('undead-'+id,clone.fighter,v,renderStage,s);});
    for(const root of [this.undead.root,this.structures.root,this.nikalz.root,this.jopa.root,this.napa.root,this.dodo.root,this.finance.root,this.eide.root,this.fausto.root,this.astolfo.root,this.hair.root,this.spears.root])env.shader.apply(root);
    this.bloom.enabled=visualPresets[env.quality].bloom&&c.bloomStrength>0;this.bloom.strength=c.bloomStrength*(env.quality==='medium'?.6:1);
    this.atmosphere.enabled=env.quality!=='low';this.atmosphere.uniforms.tint.value.set(c.tint);this.atmosphere.uniforms.strength.value=c.tintStrength;this.atmosphere.uniforms.vignette.value=c.vignette;this.atmosphere.uniforms.grain.value=env.quality==='high'?c.grain:0;this.atmosphere.uniforms.clock.value=time;
    this.renderer.info.reset();this.composer.render();
    env.finish((import.meta as ImportMeta & {env:{DEV:boolean}}).env.DEV&&this.debug,this.renderer);
    });
  }
}
