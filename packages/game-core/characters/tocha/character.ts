import type { CharacterDefinition, MoveDefinition } from "../../types.js";
import { move } from "../common.js";
const fire = (id: string, patch: Partial<MoveDefinition> = {}) => move(id, { effects: "fire-hit", cancelRules: [], ...patch });
const moves = {
  jab: fire("jab", { displayName: "Fire jab", knockback: 3 }),
  cross: fire("cross", { displayName: "Fire cross", startupFrames: 6, activeFrames: 4, recoveryFrames: 14, damage: 58, knockback: 4, hitstun: 24 }),
  finisher: fire("finisher", { displayName: "Flame kick", burn: {duration:180,damage:10}, startupFrames: 8, activeFrames: 5, recoveryFrames: 20, damage: 82, priority: 2, knockback: 15, hitboxes: [{x: 20, y: 50, w: 125, h: 50}] }),
  heavy: fire("heavy", { displayName: "Heavy fire kick", state: "HeavyAttack", startupFrames: 15, activeFrames: 6, recoveryFrames: 24, damage: 125, priority: 3, knockback: 16, launch: 12, knockdown: true, hitboxes: [{x: 20, y: 65, w: 140, h: 65}] }),
  double: fire("double", { displayName: "Double inferno", state: "HeavyAttack", startupFrames: 18, activeFrames: 5, recoveryFrames: 26, damage: 95, priority: 3, knockback: 12, hitstun: 30, burn: { duration: 180, damage: 10 }, hitboxes: [{x: 20, y: 65, w: 125, h: 50}] }),
  crouch: fire("crouch", { displayName: "Low flame kick", state: "CrouchingAttack", level: "low", startupFrames: 8, activeFrames: 5, recoveryFrames: 17, damage: 65, hitboxes: [{x: 20, y: 5, w: 115, h: 35}] }),
  air: fire("air", { displayName: "Air flame kick", state: "AirAttack", level: "high", startupFrames: 7, activeFrames: 9, recoveryFrames: 14, damage: 75, hitboxes: [{x: 10, y: 35, w: 125, h: 60}] }),
  fireball: fire("fireball", {meterCost:25,  displayName: "Fireball", state: "SpecialMove", startupFrames: 18, activeFrames: 3, recoveryFrames: 25, damage: 70, priority: 2, meterGain: 10, hitboxes: [], projectile: {speed: 12, lifetime: 150, radius: 25, visual: "fire"}, burn: {duration: 240, damage: 10} }),
  pentagram: fire("pentagram", {meterCost:25,  displayName: "Heavy Metal pentagram", state: "SpecialMove", startupFrames: 24, activeFrames: 3, recoveryFrames: 30, damage: 0, meterGain: 0, hitboxes: [], hazard: {duration: 480, radius: 120, damage: 18, interval: 30, burn: {duration: 240, damage: 10}} }),
  ignite: fire("ignite", { displayName: "On fire", state: "SpecialMove", startupFrames: 18, activeFrames: 3, recoveryFrames: 15, damage: 0, meterCost: 100, meterGain: 0, hitboxes: [], auraFrames: 1980 }),
  satan: fire("satan", { displayName: "Metal Head Banging", hazard: {duration:1020,radius:240,damage:0,interval:30,startFrame:0,burn:{duration:720,damage:20,kind:"purple"}}, burn: {duration: 720, damage: 20, kind: "purple"}, state: "SpecialMove", startupFrames: 90, activeFrames: 4, recoveryFrames: 36, damage: 360, priority: 5, meterCost: 100, meterGain: 0, knockback: 24, launch: 18, knockdown: true, hitboxes: [], projectile: {speed: 15, lifetime: 150, radius: 70, visual: "pentagram", homing: true}, events: [{frame: 10, type: "sound", id: "metal"}] }),
};
export const character: CharacterDefinition = {
  id: "tocha", auraTrailMove:"ignite", displayName: "TOCHA", description: "Fire & heavy metal · 1.74 m", color: "#ff743c",
  skins: [{id: "original", name: "Skull tee"}, {id: "shirtless", name: "Shirtless"}],
  stats: { maxHealth: 1400, walkSpeed: 5, backwardSpeed: 4, jumpVelocity: 22, gravity: 1, weight: 100 },
  moves, basicAttacks: {chain: ["jab", "cross", "finisher"], heavy: "heavy", kick: "double", crouch: "crouch", air: "air"},
  specialButtons: ["fireball", "pentagram"], superButtons: ["ignite", "satan"],
  specialMoves: [{motion: "236", move: "fireball"}],
  animations: Object.fromEntries(Object.keys(moves).map(id => [id, {kind: "sprite", duration: 30}])),
  sounds: {hit: "impact", special: "fire"}, effects: {hit: "fire-hit"},
  assets: { idleAtlas: "/art/tocha/idle-v1.png", fireAtlas: "/art/tocha/skin-1-fire-attacks.png", alternateFireAtlas: "/art/tocha/skin-2-fire-attacks.png", atlas: "/art/tocha/skin-1-atlas.png", alternateAtlas: "/art/tocha/skin-2-atlas.png", portrait: "/art/tocha/portrait-user-skull-v3.png", alternatePortrait: "/art/tocha/portrait-user-shirtless-v2.png" }, states: {},
};
