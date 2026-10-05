import * as THREE from "three";
import type { Fighter, MoveDefinition } from "../../../../packages/game-core/types.js";

/** Bounds are exclusive at right/bottom. Pivot is the body's horizontal anchor. */
export type PixelFrame = readonly [left: number, top: number, right: number, bottom: number, pivot: number];
export interface PixelAtlasDefinition {
  url: string;
  width: number;
  height: number;
  pixelsPerUnit: number;
  frames: Readonly<Record<number, PixelFrame>>;
}
export interface PixelVisualDefinition {
  atlases: readonly PixelAtlasDefinition[];
  /** Override a move's animation ID without adding fighter-ID branches to the renderer. */
  animationPoses?: Readonly<Record<string, number>>;
  /** Optional complete pose selector for fighters with different animation layouts. */
  selectPose?: (fighter: Fighter, move?: MoveDefinition) => number;
}

export function validatePixelVisual(definition: PixelVisualDefinition): void {
  const poses = new Set<number>();
  if (!definition.atlases.length) throw new Error("A pixel fighter needs at least one atlas");
  for (const atlas of definition.atlases) {
    if (!atlas.url || ![atlas.width, atlas.height, atlas.pixelsPerUnit].every(n => Number.isFinite(n) && n > 0))
      throw new Error("Pixel atlas dimensions and scale must be positive");
    for (const [key, frame] of Object.entries(atlas.frames)) {
      const pose = Number(key);
      const [left, top, right, bottom, pivot] = frame;
      if (!Number.isInteger(pose) || pose < 0 || poses.has(pose))
        throw new Error(`Invalid or duplicate pixel pose ${key}`);
      if (!frame.every(Number.isFinite) || left < 0 || top < 0 || right > atlas.width || bottom > atlas.height || right <= left || bottom <= top || pivot < left || pivot > right)
        throw new Error(`Pixel pose ${key} falls outside its atlas`);
      poses.add(pose);
    }
  }
  if (!poses.has(0)) throw new Error("A pixel fighter needs idle pose 0 as its fallback");
  for (const pose of Object.values(definition.animationPoses ?? {})) {
    if (!poses.has(pose)) throw new Error(`Animation uses missing pixel pose ${pose}`);
  }
}

/** Reuses decoded resources across fighters; a failed request can be retried. */
export class FighterTextureCache {
  private textures = new Map<string, Promise<THREE.Texture>>();
  constructor(private loadTexture: (url: string) => Promise<THREE.Texture> = url => new THREE.TextureLoader().loadAsync(url)) {}
  load(url: string): Promise<THREE.Texture> {
    const existing = this.textures.get(url);
    if (existing) return existing;
    const request = this.loadTexture(url).then(texture => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.generateMipmaps = false;
      return texture;
    }).catch((error: unknown) => {
      this.textures.delete(url);
      throw error;
    });
    this.textures.set(url, request);
    return request;
  }
}
