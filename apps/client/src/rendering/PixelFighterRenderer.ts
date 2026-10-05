import * as THREE from "three";
import type { Fighter, CharacterDefinition } from "../../../../packages/game-core/types.js";
import { surfaceBelow } from "../../../../packages/game-core/simulation/StageCollision.js";
import {renderStage as trainingRoom} from "./StageCoordinates.js";
import type { FighterVisual } from "./FighterRenderer.js";
import { worldX } from "./StageCoordinates.js";
import { crouchAtlas } from "./CrouchAtlas.js";
import { movementAtlases } from "./MovementAtlas.js";
import { pixelPose } from "./PixelAnimation.js";

// Individual bounds preserve artwork that extends beyond the nominal atlas grid.
// Last number is the body pivot, independent of an outstretched hand or foot.
const frames = {
  "prototype-a": [
    [48,19,258,312,153],[366,42,575,312,470],[671,19,880,314,775],[985,19,1205,314,1095],
    [50,382,242,610,146],[367,323,570,614,468],[625,335,914,614,741],[976,332,1247,619,1085],
    [29,637,319,934,112],[372,636,584,866,478],[633,653,967,871,756],[1024,629,1208,934,1113],
    [42,959,286,1230,153],[356,971,589,1230,472],[632,1142,948,1230,790],[1016,939,1208,1237,1112],
  ],
  "prototype-b": [
    [54,36,262,318,158],[362,65,574,318,468],[661,36,895,318,778],[982,36,1207,318,1094],
    [45,401,258,612,152],[363,341,577,613,470],[652,358,927,612,755],[949,356,1244,612,1077],
    [41,654,321,925,128],[399,631,575,875,484],[652,667,964,867,760],[1022,624,1196,927,1110],
    [31,970,302,1226,155],[360,968,600,1222,480],[640,1108,968,1218,804],[1012,933,1217,1226,1115],
  ],
};

export class PixelFighterRenderer implements FighterVisual {
  root = new THREE.Group();
  shadow: THREE.Mesh;
  private texture: THREE.Texture;
  private movementTexture: THREE.Texture;
  private crouchTexture: THREE.Texture;
  private sprite: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  constructor(private definition: CharacterDefinition, atlas: THREE.Texture, movementAtlas: THREE.Texture = atlas, crouchingAtlas: THREE.Texture = atlas) {
    this.crouchTexture = crouchingAtlas.clone();
    this.crouchTexture.needsUpdate = true;
    this.texture = atlas.clone();
    this.texture.needsUpdate = true;
    this.movementTexture = movementAtlas.clone();
    this.movementTexture.needsUpdate = true;
    this.sprite = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
      map: this.texture, transparent: true, alphaTest: .15, side: THREE.DoubleSide, toneMapped: false,
    }));
    this.root.add(this.sprite);
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(.5, 32), new THREE.MeshBasicMaterial({color: 0x15121a, transparent: true, opacity: .22, depthWrite: false}));
    this.shadow.rotation.x = -Math.PI / 2;
  }
  update(f: Fighter, _time: number): void {
    const move = f.move ? this.definition.moves[f.move] : undefined;
    const pose = pixelPose(f, move);
    const id = this.definition.id as keyof typeof frames;
    const crouching = pose >= 24;
    const movement = pose >= 16 && !crouching;
    const crouchRow = id === "prototype-b" ? 3 : 0;
    const metadata = movementAtlases[id];
    const texture = crouching ? this.crouchTexture : movement ? this.movementTexture : this.texture;
    this.sprite.material.map = texture;
    const [left, top, right, bottom, pivot] = crouching ? crouchAtlas.frames[crouchRow + pose - 24] : movement ? metadata.frames[pose - 16] : frames[id][pose];
    const x = left - 2, y = top - 2, w = right - left + 4, h = bottom - top + 4;
    const atlasWidth = crouching ? crouchAtlas.width : movement ? metadata.width : 1254;
    const atlasHeight = crouching ? crouchAtlas.height : movement ? metadata.height : 1254;
    texture.repeat.set(w / atlasWidth, h / atlasHeight);
    texture.offset.set(x / atlasWidth, 1 - (y + h) / atlasHeight);
    const height = id === "prototype-b" ? 1.9 : 1.8;
    const scale = crouching ? (id === "prototype-b" ? 1.42 : 1.4) / (crouchAtlas.frames[crouchRow][3] - crouchAtlas.frames[crouchRow][1]) : height / (movement ? metadata.standingHeight : id === "prototype-b" ? 282 : 293);
    this.sprite.scale.set(w * scale, h * scale, 1);
    this.sprite.position.set((x + w / 2 - pivot) * scale, (h / 2 - 2) * scale, 0);
    this.root.position.set(worldX(f.x), f.y / 100, .08);
    this.root.scale.x = f.facing;
    const surface = surfaceBelow(trainingRoom, f.x, f.y);
    this.shadow.position.set(worldX(f.x), surface / 100 + .02, 0);
    const shadowScale = Math.max(.4, 1 - (f.y - surface) / 700);
    this.shadow.scale.set(shadowScale * 1.3, shadowScale * .5, 1);
  }
  dispose(): void {
    this.crouchTexture.dispose();
    this.texture.dispose();
    this.movementTexture.dispose();
    this.sprite.geometry.dispose();
    this.sprite.material.dispose();
    this.shadow.geometry.dispose();
    (this.shadow.material as THREE.Material).dispose();
  }
}
