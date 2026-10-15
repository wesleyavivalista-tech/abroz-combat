import * as THREE from "three";
import type { Fighter } from "../../../../packages/game-core/types.js";
import { SpriteIsolation } from "./SpriteIsolation.js";

type Character = "tocha" | "bozo" | "clone";
const bounds = {
  clone: [[33,67,367,479],[461,68,716,479],[814,68,1137,479],[1240,69,1497,479],[27,604,350,971],[402,544,686,916],[774,590,1114,971],[1192,584,1506,972]],
  tocha: [[129,11,359,287],[513,13,672,287],[850,10,1039,287],[1203,11,1414,287],[139,301,321,539],[506,291,704,519],[816,296,1055,542],[1202,292,1431,542],[120,546,361,806],[501,546,673,806],[842,547,1038,806],[1202,547,1419,805],[122,811,311,1021],[497,815,681,1005],[811,813,1050,1022],[1204,808,1425,1022]],
  bozo: [[67, 12, 318, 272], [444, 12, 702, 271], [854, 12, 1050, 270], [1213, 12, 1474, 271], [61, 299, 284, 512], [500, 280, 660, 505], [824, 289, 1085, 514], [1241, 286, 1474, 514], [67, 524, 319, 786], [444, 523, 703, 786], [843, 523, 1073, 787], [1211, 524, 1483, 788], [68, 803, 283, 1020], [501, 794, 669, 1007], [828, 805, 1088, 1020], [1232, 794, 1477, 1020]],
} as const;
// Align the pelvis, rather than the changing silhouette of an extended foot.
const pivots = {
  clone: [186,577,975,1362,190,552,963,1350],
  tocha: [240,591,949,1305,233,597,950,1320,240,590,948,1305,228,589,944,1320],
  bozo: [185.76, 572.43, 944.23, 1328.97, 187.49, 571.03, 995.03, 1352.08, 181.94, 570.87, 950.46, 1334.51, 191.31, 589.09, 989.5, 1352.79],
};

/** Simulation time, independent of arena position, facing and render frame rate. */
export function guardedMovementFrame(f: Fighter, character: Character): number | null {
  if (f.move) return null;
  if (f.state === "DashBackward") return 4 + (f.stateFrame < 2 ? 0 : f.stateFrame < 6 ? 1 : f.stateFrame < 9 ? 2 : 3);
  if (f.state !== "WalkForward" && f.state !== "WalkBackward") return null;
  const backward = f.state === "WalkBackward";
  const cycle = character !== "bozo" ? [0,1,2,3] : [0,2,3,1];
  const phase = Math.floor(f.stateFrame / (backward ? 8 : 6)) % 4;
  return cycle[backward ? (4-phase)%4 : phase];
}

/** Four authored walk poses and four load / hop / catch / recovery back-dash poses. */
export class GuardedMovement {
  private texture: THREE.Texture;
  constructor(atlas: THREE.Texture, private character: Character) {
    this.texture = atlas.clone(); this.texture.needsUpdate = true;
  }
  apply(f: Fighter, skin: number, sprite: THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>, isolation: SpriteIsolation): boolean {
    const frame = guardedMovementFrame(f,this.character);
    if (frame === null) return false;
    const pose = (this.character === "clone" ? 0 : skin*8)+frame;
    const [l,t,r,b] = bounds[this.character][pose];
    const width=r-l+2,height=b-t+2;
    // Calibrate Bozo to the standing pose in this skin; preserve the art aspect ratio.
    const scale=this.character === "tocha" ? 1.74/(skin ? 260 : 276) : this.character === "clone" ? 1.64/412 : 1.64/(bounds.bozo[skin*8][3]-bounds.bozo[skin*8][1]+2);
    this.texture.repeat.set(width/1536,height/1024);
    this.texture.offset.set((l-1)/1536,1-(b+1)/1024);
    sprite.material.map=this.texture;
    isolation.select(this.texture,bounds[this.character],pose);
    sprite.scale.set(width*scale,height*scale,1);
    // A shallow visual hop; collision position and dash distance remain unchanged.
    const lift=f.state === "DashBackward" ? Math.sin(Math.min(1,f.stateFrame/11)*Math.PI)*.13 : 0;
    sprite.position.set(((l+r)/2-pivots[this.character][pose])*scale,height*scale/2+lift,0);
    return true;
  }
  dispose(): void { this.texture.dispose(); }
}
