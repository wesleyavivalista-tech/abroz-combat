import {playbackFrame,validateFrameTiming} from './AnimationPlayback.js';
import { worldX } from "./StageCoordinates.js";
import * as THREE from "three";
import type { Fighter } from "../../../../packages/game-core/types.js";
import type { FighterVisual } from "./FighterRenderer.js";
export interface SpriteClip {
  row: number;
  start: number;
  frames: number;
  ticksPerFrame: number;
  loop: boolean;
  frameDurations?: readonly number[];
}
/** Atlas resources must be loaded before constructing the adapter. */
export class SpriteFighterRenderer implements FighterVisual {
  root = new THREE.Group();
  private sprite: THREE.Mesh;
  private texture: THREE.Texture;
  constructor(
    atlas: THREE.Texture,
    private columns: number,
    private rows: number,
    private clips: Record<string, SpriteClip>,
    width = 1.6,
    height = 1.8,
  ) {
    Object.values(clips).forEach(validateFrameTiming);
    this.texture = atlas.clone();
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.repeat.set(1 / columns, 1 / rows);
    this.texture.needsUpdate = true;
    this.sprite = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({
        map: this.texture,
        transparent: true,
        alphaTest: 0.05,
        side: THREE.DoubleSide,
      }),
    );
    this.sprite.position.y = height / 2;
    this.root.add(this.sprite);
  }
  update(f: Fighter, _time: number): void {
    this.root.position.set(worldX(f.x), f.y / 100, 0.05);
    this.root.scale.x = f.facing;
    const clip = this.clips[f.move ?? f.state] ?? this.clips.Idle;
    if (!clip) return;
    const index = clip.start + playbackFrame(f.move ? f.moveFrame : f.stateFrame, clip);
    this.texture.offset.set(
      index / this.columns,
      1 - (clip.row + 1) / this.rows,
    );
  }
  dispose(): void {
    this.texture.dispose();
    this.sprite.geometry.dispose();
    (this.sprite.material as THREE.Material).dispose();
  }
}
