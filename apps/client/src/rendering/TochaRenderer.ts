import { AuthoredWalk } from './AuthoredWalk.js';
import { ExpandedAnimation } from './ExpandedAnimation.js';
import { actionMotion } from './ActionMotion.js';
import { GuardedMovement } from "./GuardedMovement.js";
import { SpriteIsolation } from "./SpriteIsolation.js";
import { tochaFireFrames, tochaFirePivots, tochaFireFeet } from "./TochaFireAtlas.js";
import * as THREE from "three";
import type { CharacterDefinition, Fighter } from "../../../../packages/game-core/types.js";
import type { FighterVisual } from "./FighterRenderer.js";
import { worldX } from "./StageCoordinates.js";
import { surfaceBelow } from "../../../../packages/game-core/simulation/StageCollision.js";
import {renderStage as trainingRoom} from "./StageCoordinates.js";
import { tochaFrames } from "./TochaAtlas.js";
export function tochaPose(f: Fighter, def: CharacterDefinition): number {
  if (f.move) {
    const m = def.moves[f.move];
    if (f.move === "satan") return f.moveFrame < m.startupFrames ? 16 + Math.floor(f.moveFrame / 9) % 2 : 13;
    if (f.move === "ignite") return 15;
    if (f.move === "pentagram") return 14;
    if (f.moveFrame < Math.max(2, m.startupFrames - 5)) return f.state === "CrouchingAttack" ? 18 : f.state === "AirAttack" ? 21 : 0;
    if (f.moveFrame > m.startupFrames + m.activeFrames + 7) return f.state === "CrouchingAttack" ? 18 : f.state === "AirAttack" ? 21 : 0;
    return ({jab: 8, cross: 9, finisher: 10, heavy: 11, double: 12, fireball: 13, crouch: 20, air: 10} as Record<string, number>)[f.move] ?? 0;
  }
  if (["KO", "Knockdown", "Respawning"].includes(f.state)) return 23;
  if (f.state.includes("HitStun")) return 22;
  if (["Crouch", "BlockCrouching", "GetUp"].includes(f.state)) return 18;
  if (["Jump", "Fall"].includes(f.state)) return 21;
  if (f.state.startsWith("Dash")) return 5 + Math.floor(f.stateFrame / 3) % 3;
  if (f.state.startsWith("Walk")) {
    const cycle = Math.floor(Math.abs(f.x) / 18) % 4;
    return 1 + (f.state === "WalkBackward" ? 3 - cycle : cycle);
  }
  return f.state === "MatchWin" ? 16 : 0;
}
export function tochaFireFrame(f: Fighter, def: CharacterDefinition): number | null {
  const indices: Record<string, number> = {jab: 0, cross: 1, finisher: 2, heavy: 3, double: 4, fireball: 5, crouch: 6, air: 7};
  if (!f.move || indices[f.move] === undefined) return null;
  const pose = tochaPose(f, def);
  return [0,18,21].includes(pose) ? null : indices[f.move];
}
/** Four drawn breathing poses, paced by simulation ticks so pause/hitstop freezes them. */
export function tochaIdleFrame(f: Fighter): number | null {
  return !f.move && f.state === "Idle" ? Math.floor(f.stateFrame / 24) % 4 : null;
}
export class TochaRenderer implements FighterVisual {
 get fallBodies():THREE.Object3D[]{return [this.sprite];}
  root = new THREE.Group();
  shadow: THREE.Mesh;
  private authoredWalk?: AuthoredWalk;
  private isolation: SpriteIsolation;
  private expansion?: ExpandedAnimation;
  private movement?: GuardedMovement;
  private textures: THREE.Texture[];
  private idleTexture?: THREE.Texture;
  private fireTextures: THREE.Texture[];
  private sprite: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  constructor(private def: CharacterDefinition, atlases: THREE.Texture[], private skin: number, fireAtlases: THREE.Texture[] = [], idleAtlas?: THREE.Texture, movementAtlas?: THREE.Texture, expansionAtlas?: THREE.Texture, walkTextures?: THREE.Texture[]) {
    if(walkTextures)this.authoredWalk=new AuthoredWalk(walkTextures,"tocha");
    if (expansionAtlas) this.expansion = new ExpandedAnimation(expansionAtlas, "tocha");
    if (movementAtlas) this.movement = new GuardedMovement(movementAtlas, "tocha");
    this.idleTexture = idleAtlas?.clone();
    if (this.idleTexture) this.idleTexture.needsUpdate = true;
    this.fireTextures = fireAtlases.map(t => {const clone = t.clone(); clone.needsUpdate = true; return clone;});
    this.textures = atlases.map(t => {const clone = t.clone(); clone.needsUpdate = true; return clone;});
    this.sprite = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({map: this.textures[skin], transparent: true, alphaTest: .2, toneMapped: false, side: THREE.DoubleSide}));
    this.isolation = new SpriteIsolation(this.sprite.material);
    this.root.add(this.sprite);
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(.5, 24), new THREE.MeshBasicMaterial({color: 0x15121a, transparent: true, opacity: .22, depthWrite: false}));
    this.shadow.rotation.x = -Math.PI / 2;
  }
  update(f: Fighter, _time: number): void {
    const skin = f.move === "satan" ? 1 : this.skin;
    const pose = tochaPose(f, this.def);
    const frames = tochaFrames[skin ? "2" : "1"];
    const fireFrame = this.fireTextures.length ? tochaFireFrame(f, this.def) : null;
    const [left, top, right, bottom] = fireFrame === null ? frames[pose] : tochaFireFrames[skin ? "2" : "1"][fireFrame];
    const w = right - left + 2, h = bottom - top + 2;
    const texture = fireFrame === null ? this.textures[skin] : this.fireTextures[skin];
    texture.repeat.set(w / 1536, h / 1024);
    texture.offset.set((left - 1) / 1536, 1 - (bottom + 1) / 1024);
    this.sprite.material.map = texture;
    this.isolation.select(texture, fireFrame === null ? frames : tochaFireFrames[skin ? "2" : "1"], fireFrame ?? pose);
    const scale = fireFrame === null ? 1.74 / (frames[0][3] - frames[0][1]) : skin ? 1.62 / 287 : 1.58 / 264;
    // Body pivots stay behind extended hands/feet, avoiding pose-to-pose sliding.
    const pivotFraction = [0.50,.5,.5,.5,.5,.52,.52,.52,.37,.37,.28,.27,.36,.33,.47,.5,.5,.5,.5,.31,.26,.5,.52,.5][pose];
    const pivot = fireFrame === null ? left + (right - left) * pivotFraction : tochaFirePivots[skin][fireFrame];
    const feet = fireFrame === null ? bottom + 1 : tochaFireFeet[skin][fireFrame];
    this.sprite.scale.set(w * scale, h * scale, 1);
    this.sprite.position.set(((left + right) / 2 - pivot) * scale, (feet - (top + bottom) / 2) * scale, 0);
    const idleFrame = this.idleTexture ? tochaIdleFrame(f) : null;
    if (idleFrame !== null && this.idleTexture) {
      // Fixed cells and shoe baselines keep the stance planted while the chest rises.
      const idleScale = 1.74 / (skin ? 428 : 432);
      const feet = skin ? [475, 476, 475, 476][idleFrame] : 478;
      this.idleTexture.repeat.set(384 / 1536, 512 / 1024);
      this.idleTexture.offset.set(idleFrame / 4, skin ? 0 : .5);
      this.sprite.material.map = this.idleTexture;
      this.isolation.select(this.idleTexture, Array.from({length:8},(_,i)=>[(i%4)*384,Math.floor(i/4)*512,(i%4+1)*384-1,(Math.floor(i/4)+1)*512-1]),skin*4+idleFrame);
      this.sprite.scale.set(384 * idleScale, 512 * idleScale, 1);
      this.sprite.position.set(0, (feet - 256) * idleScale, 0);
    }
    this.movement?.apply(f, skin, this.sprite, this.isolation);
    this.expansion?.apply(f, skin, this.sprite, this.isolation);
    this.authoredWalk?.apply(f,skin,this.sprite,this.isolation);
    const motion = actionMotion(f, f.move ? this.def.moves[f.move] : undefined);
    this.sprite.position.x += motion.x; this.sprite.rotation.z = motion.angle;
    this.root.position.set(worldX(f.x), f.y / 100, .09);
    this.root.scale.x = f.facing;
    const floor = surfaceBelow(trainingRoom, f.x, f.y);
    this.shadow.position.set(worldX(f.x), floor / 100 + .02, 0);
    const size = Math.max(.4, 1 - (f.y - floor) / 700);
    this.shadow.scale.set(size * 1.2, size * .5, 1);
  }
  dispose(): void {
    
    this.authoredWalk?.dispose();
    this.expansion?.dispose();
    this.movement?.dispose();
    this.idleTexture?.dispose();
    this.textures.forEach(t => t.dispose());
    this.fireTextures.forEach(t => t.dispose());
    this.sprite.geometry.dispose(); this.sprite.material.dispose();
    this.shadow.geometry.dispose(); (this.shadow.material as THREE.Material).dispose();
  }
}
