import * as THREE from 'three';
import type { Fighter } from '../../../../packages/game-core/types.js';
import { characters } from '../../../../packages/game-core/characters/registry.js';
import { SpriteIsolation } from './SpriteIsolation.js';
import { attackPhase } from './ActionMotion.js';
import { expansionFrames } from './ExpansionAtlas.js';

export type ExpansionCharacter = 'tocha' | 'bozo' | 'gut' | 'clone';
const kickMoves: Record<string, readonly string[]> = {tocha:['finisher','heavy'],bozo:['kick'],gut:['finish','axe']};
const punches: Record<string, readonly string[]> = {tocha:['jab','cross','double'],bozo:['jab','cross','beard','heavy'],gut:['palm','cross','swing']};
export function expansionFrame(f: Fighter, character: ExpansionCharacter): number | null {
  if (!f.move && ['JumpStartup','Land','DashBackward'].includes(f.state)) {
    const settling = f.state !== 'DashBackward' || f.stateFrame < 2 || f.stateFrame >= 9;
    if (settling && character === 'gut') return 3;
    if (settling && character === 'clone') return 7;
  }
  if (!f.move && f.state.startsWith('Walk') && character === 'tocha') {
    const step = Math.floor(f.stateFrame / (f.state === 'WalkBackward' ? 6 : 5)) % 6;
    return f.state === 'WalkBackward' ? (6 - step) % 6 : step;
  }
  if (!f.move && f.state.startsWith('Walk') && character === 'clone') {
    const step = Math.floor(f.stateFrame / (f.state === 'WalkBackward' ? 4 : 3)) % 8;
    const phase = f.state === 'WalkBackward' ? (8 - step) % 8 : step;
    // Four new passing/contact poses alternate with the existing four guard steps.
    return phase % 2 ? Math.floor(phase/2) : null;
  }
  const id = character === 'clone' ? 'bozo' : character;
  if (!f.move || ![...kickMoves[id], ...punches[id]].includes(f.move)) return null;
  const phase = attackPhase(f.moveFrame, characters[id].moves[f.move]);
  if (phase === 'strike' || phase === 'guard') return null;
  const kick = kickMoves[id].includes(f.move);
  if (character === 'tocha') return kick ? 7 : 6;
  if (character === 'bozo') return kick ? 5 : 4;
  if (character === 'clone') return kick ? 6 : 5;
  return kick ? 2 : 0;
}

/** Reviewed walk in-betweens and attack transition poses; no gameplay changes. */
export class ExpandedAnimation {
  private texture: THREE.Texture;
  constructor(atlas: THREE.Texture, private character: ExpansionCharacter) {
    this.texture = atlas.clone(); this.texture.needsUpdate = true;
  }
  apply(f: Fighter, skin: number, sprite: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>, isolation: SpriteIsolation): boolean {
    const frame = expansionFrame(f, this.character);
    if (frame === null) return false;
    const index = (this.character === 'clone' ? 0 : skin * (this.character === 'tocha' ? 8 : this.character === 'gut' ? 4 : 12)) + frame;
    const data = expansionFrames[this.character];
    const [l,t,r,b,pivot] = data.frames[index], width=r-l+2, height=b-t+2;
    const characterHeight = this.character === 'gut' ? 1.8 : this.character === 'tocha' ? 1.74 : 1.64;
    // Uniform scale: no skinny limbs, changes in body width, or image stretching.
    const scale = characterHeight / (frame < 6 && this.character === 'tocha' ? height : data.heights[index]);
    this.texture.repeat.set(width/data.width, height/data.height);
    this.texture.offset.set((l-1)/data.width, 1-(b+1)/data.height);
    sprite.material.map=this.texture;
    isolation.select(this.texture,data.frames,index);
    sprite.scale.set(width*scale,height*scale,1);
    sprite.position.set(((l+r)/2-pivot)*scale,height*scale/2,0);
    return true;
  }
  dispose(): void { this.texture.dispose(); }
}
