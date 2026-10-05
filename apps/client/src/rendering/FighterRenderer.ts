import {
  grounded,
  surfaceBelow,
} from "../../../../packages/game-core/simulation/StageCollision.js";
import {renderStage as trainingRoom} from "./StageCoordinates.js";
import { worldX } from "./StageCoordinates.js";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { characters } from "../../../../packages/game-core/characters/registry.js";
import type { Fighter } from "../../../../packages/game-core/types.js";
export interface FighterVisual {
  /** Body-only objects replaced by authored neutral descent art; effects stay live. */
  readonly fallBodies?: readonly THREE.Object3D[];
  root: THREE.Group;
  shadow?: THREE.Mesh;
  update(f: Fighter, time: number, simulationFrame?: number): void;
  dispose(): void;
}

/** Contemporary street fighters with fabric, skin and articulated limbs. Animation follows authoritative tick data. */
export class FighterRenderer implements FighterVisual {
  root = new THREE.Group();
  body = new THREE.Group();
  arms: THREE.Group[] = [];
  elbows: THREE.Group[] = [];
  legs: THREE.Group[] = [];
  knees: THREE.Group[] = [];
  shadow: THREE.Mesh;
  private head = new THREE.Group();
  private materials: THREE.Material[] = [];
  private surface: THREE.CanvasTexture;
  constructor(color: string, heavy = false) {
    this.root.add(this.body);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const paint = canvas.getContext("2d")!;
    paint.fillStyle = "#999999";
    paint.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 550; i++) {
      paint.fillStyle = i % 3 ? "#888888" : "#bbbbbb";
      paint.fillRect((i * 43) % 128, (i * 71) % 128, 2 + (i % 11), 1);
    }
    paint.strokeStyle = "#444444";
    paint.strokeRect(8, 8, 112, 112);
    this.surface = new THREE.CanvasTexture(canvas);
    this.surface.wrapS = this.surface.wrapT = THREE.RepeatWrapping;
    const material = (tint: string, roughness = 0.85) => {
      const m = new THREE.MeshStandardMaterial({ color: tint, roughness,
        metalness: 0, bumpMap: this.surface, bumpScale: 0.001 });
      this.materials.push(m);
      return m;
    };
    const skin = material(heavy ? "#844e34" : "#c68e65", 0.72);
    const fabric = material(heavy ? "#b95732" : "#627c4b");
    const pants = material(heavy ? "#20232b" : "#303a40");
    const hair = material("#211b1a");
    const white = material("#e4dfcf");
    const sole = material("#bcb5a6");
    const eyes = material("#201c1b");
    const accent = material(color);
    const rounded = (w: number, h: number, d: number, r = 0.05) =>
      new RoundedBoxGeometry(w, h, d, 3, r);
    const part = (geometry: THREE.BufferGeometry, m: THREE.Material,
      parent: THREE.Object3D, x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(geometry, m);
      mesh.position.set(x, y, z); mesh.castShadow = true; parent.add(mesh);
      return mesh;
    };
    const ellipsoid = (parent: THREE.Object3D, m: THREE.Material,
      x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
      const mesh = part(new THREE.SphereGeometry(1, 14, 10), m, parent, x, y, z);
      mesh.scale.set(sx, sy, sz); return mesh;
    };
    // Fabric torso, waistband and an open collar, with a heavier boxer silhouette.
    part(rounded(heavy ? 0.55 : 0.44, 0.48, heavy ? 0.38 : 0.31, 0.12), fabric, this.body, 0, 1.12, 0);
    part(rounded(0.36, 0.14, 0.3), pants, this.body, 0, 0.8, 0);
    part(rounded(0.37, 0.06, 0.32, 0.02), fabric, this.body, 0, 0.88, 0);
    part(new THREE.CylinderGeometry(0.085, 0.095, 0.16, 12), skin, this.body, 0.01, 1.41, 0);
    for (const side of [-1, 1]) {
      part(rounded(0.014, 0.36, 0.014, 0.004), heavy ? pants : white,
        this.body, 0.015, 1.15, side * (heavy ? 0.201 : 0.168));
      const pocket = part(rounded(0.12, 0.014, 0.012, 0.004), pants,
        this.body, -0.11, 1.0, side * (heavy ? 0.2 : 0.167));
      pocket.rotation.z = -0.3;
      if (heavy) {
        ellipsoid(this.body, fabric, -0.18, 1.39, side * 0.09, 0.13, 0.1, 0.12);
        part(rounded(0.016, 0.17, 0.016, 0.004), white, this.body, 0.08, 1.26, side * 0.2);
      }
    }
    this.head.position.set(0.035, 1.59, 0);
    this.body.add(this.head);
    ellipsoid(this.head, skin, 0, 0, 0, 0.145, 0.19, 0.145);
    part(rounded(0.18, 0.105, 0.22, 0.04), skin, this.head, 0.035, -0.12, 0);
    ellipsoid(this.head, skin, 0.142, -0.015, 0, 0.047, 0.046, 0.045);
    ellipsoid(this.head, hair, -0.035, 0.125, 0, 0.145, heavy ? 0.065 : 0.11, 0.15);
    if (!heavy) {
      for (let i = 0; i < 5; i++)
        ellipsoid(this.head, hair, -0.1 + i * 0.047, 0.19 + (i % 2) * 0.015, 0, 0.043, 0.044, 0.12);
    } else {
      part(rounded(0.17, 0.065, 0.235, 0.025), hair, this.head, 0.045, -0.142, 0);
    }
    for (const side of [-1, 1]) {
      ellipsoid(this.head, skin, -0.055, -0.016, side * 0.148, 0.033, 0.05, 0.021);
      part(rounded(0.05, 0.015, 0.012, 0.003), eyes, this.head, 0.077, 0.021, side * 0.13);
      const brow = part(rounded(0.067, 0.016, 0.015, 0.003), hair, this.head, 0.067, 0.056, side * 0.128);
      brow.rotation.z = -0.1;
    }
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;
      const arm = new THREE.Group(); arm.position.set(0, 1.29, side * (heavy ? 0.25 : 0.205)); this.body.add(arm);
      ellipsoid(arm, heavy ? skin : fabric, 0, -0.1, 0, heavy ? 0.13 : 0.105, 0.235, heavy ? 0.13 : 0.11);
      if (!heavy) {
        for (const offset of [-0.035, 0.035])
          part(rounded(0.025, 0.27, 0.016, 0.005), white, arm, offset, -0.15, side * 0.107);
      }
      const elbow = new THREE.Group(); elbow.position.y = -0.34; arm.add(elbow);
      ellipsoid(elbow, heavy ? skin : fabric, 0, -0.12, 0, heavy ? 0.105 : 0.083, 0.18, 0.095);
      part(rounded(0.17, 0.105, 0.19, 0.035), white, elbow, 0, -0.255, 0);
      part(rounded(heavy ? 0.23 : 0.19, 0.16, 0.21, 0.06), skin, elbow, 0.015, -0.35, 0);
      part(rounded(heavy ? 0.235 : 0.195, 0.08, 0.22, 0.025), white, elbow, 0.015, -0.335, 0);
      for (let n = 0; n < 3; n++)
        part(rounded(0.172, 0.009, 0.194, 0.003), sole, elbow, 0, -0.225 - n * 0.029, 0);
      this.arms.push(arm); this.elbows.push(elbow);
      const leg = new THREE.Group(); leg.position.set(i ? -0.09 : 0.09, 0.73, side * 0.143); this.body.add(leg);
      part(new THREE.CapsuleGeometry(heavy ? 0.127 : 0.11, 0.18, 6, 12), pants, leg, 0, -0.17, 0);
      part(rounded(0.021, 0.26, 0.014, 0.005), fabric, leg, 0, -0.16, side * 0.12);
      const knee = new THREE.Group(); knee.position.y = -0.35; leg.add(knee);
      part(new THREE.CapsuleGeometry(0.092, 0.19, 6, 12), pants, knee, 0, -0.115, 0);
      part(rounded(0.17, 0.06, 0.2, 0.02), white, knee, 0, -0.245, 0);
      part(rounded(0.34, 0.15, 0.25, 0.06), heavy ? pants : white, knee, 0.065, -0.32, 0);
      part(rounded(0.36, 0.045, 0.26, 0.018), sole, knee, 0.065, -0.385, 0);
      part(rounded(0.16, 0.035, 0.018, 0.008), accent, knee, 0.06, -0.3, side * 0.13);
      for (let n = 0; n < 3; n++)
        part(rounded(0.018, 0.012, 0.15, 0.004), white, knee, 0.025 + n * 0.04, -0.244, 0);
      this.legs.push(leg); this.knees.push(knee);
    }
    const shadowCanvas = document.createElement("canvas");
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const ctx = shadowCanvas.getContext("2d")!;
    const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    g.addColorStop(0, "#000000aa");
    g.addColorStop(0.5, "#00000066");
    g.addColorStop(1, "#00000000");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 0.85),
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(shadowCanvas),
        transparent: true,
        depthWrite: false,
      }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.017;
  }
  update(f: Fighter, time: number): void {
    this.root.position.set(worldX(f.x), f.y / 100, 0);
    this.root.scale.x = f.facing;
    this.shadow.position.x = this.root.position.x;
    const surface = surfaceBelow(trainingRoom, f.x, f.y);
    this.shadow.position.y = surface / 100 + 0.017;
    this.shadow.scale.setScalar(Math.max(0.4, 1 - (f.y - surface) / 700));
    const breath = Math.sin(time * 3.5);
    this.body.position.set(0, 0.015 + breath * 0.012, 0);
    this.body.rotation.set(0, -0.13, -0.06);
    this.body.scale.y = 1;
    this.head.rotation.z = 0.08;
    this.arms[0].rotation.z = 0.38 + breath * 0.035;
    this.arms[1].rotation.z = -0.5;
    this.elbows[0].rotation.z = 1.78;
    this.elbows[1].rotation.z = 1.9;
    this.legs[0].rotation.z = 0.38;
    this.legs[1].rotation.z = -0.38;
    this.knees[0].rotation.z = -0.2;
    this.knees[1].rotation.z = 0.15;
    if (f.state.startsWith("Walk") || f.state.startsWith("Dash")) {
      const stride = Math.sin(f.stateFrame * 0.28);
      this.legs[0].rotation.z = stride * 0.55;
      this.legs[1].rotation.z = -stride * 0.55;
      this.knees[0].rotation.z = Math.max(0, -stride) * 0.5;
      this.knees[1].rotation.z = Math.max(0, stride) * 0.5;
      this.body.position.y = Math.abs(stride) * 0.035;
      this.body.rotation.z = -0.12;
    }
    if (f.state.includes("Crouch")) {
      this.body.scale.y = 0.7;
      this.legs[0].rotation.z = 0.8;
      this.legs[1].rotation.z = -0.7;
    }
    if (!grounded(f, trainingRoom)) {
      this.legs[0].rotation.z = 0.85;
      this.legs[1].rotation.z = -0.55;
      this.knees[0].rotation.z = -0.8;
      this.arms[1].rotation.z = -1.2;
    }
    if (f.move) {
      const animation =
        characters[f.characterId].moves[f.move]?.animation ?? f.move;
      const punch = Math.sin((Math.min(1, f.moveFrame / 8) * Math.PI) / 2);
      this.arms[0].rotation.z = 0.35 + punch * 1.3;
      this.elbows[0].rotation.z = 1.75 * (1 - punch);
      this.body.rotation.z = -0.06 - 0.12 * punch;
      this.body.position.x = punch * 0.065;
      if (animation === "heavy" || f.move === "breaker") {
        this.body.rotation.z = -0.21;
        this.arms[1].rotation.z = 0.75;
      }
      if (animation === "rising") {
        this.arms[0].rotation.z = 2.85;
        this.elbows[0].rotation.z = 0.12;
        this.legs[0].rotation.z = 1;
      }
      if (animation === "special") {
        this.arms[1].rotation.z = 1.4;
        this.elbows[1].rotation.z = 0.25;
      }
      if (["crouch", "air", "kick"].includes(f.move)) {
        this.legs[0].rotation.z = 1.4;
        this.knees[0].rotation.z = 0;
      }
    }
    if (f.state.startsWith("Block")) {
      this.arms[0].rotation.z = 0.8;
      this.arms[1].rotation.z = 0.5;
      this.elbows.forEach((e) => (e.rotation.z = 2.4));
      this.body.rotation.z = 0.1;
    }
    if (f.state.includes("HitStun")) {
      this.body.rotation.z = 0.3;
      this.head.rotation.z = 0.25;
      this.arms[0].rotation.z = -0.5;
      this.elbows[0].rotation.z = 0.5;
    }
    if (["Knockdown", "KO", "MatchLose"].includes(f.state)) {
      this.body.rotation.z = -1.48;
      this.body.position.y = -0.3;
    }
    if (f.state === "MatchWin") {
      this.arms[0].rotation.z = 2.8;
      this.elbows[0].rotation.z = 0.2;
      this.arms[1].rotation.z = -0.7;
    }
  }
  dispose(): void {
    const geometry = new Set<THREE.BufferGeometry>();
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) geometry.add(o.geometry);
    });
    geometry.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    this.surface.dispose();
    this.shadow.geometry.dispose();
    const material = this.shadow.material as THREE.MeshBasicMaterial;
    material.map?.dispose();
    material.dispose();
  }
}
