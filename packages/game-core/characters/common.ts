import type { MoveDefinition } from "../types.js";
export function move(
  id: string,
  patch: Partial<MoveDefinition> = {},
): MoveDefinition {
  return {
    id,
    input: id,
    animation: id,
    state: "LightAttack",
    startupFrames: 5,
    activeFrames: 3,
    recoveryFrames: 10,
    damage: 48,
    hitstun: 19,
    blockstun: 11,
    knockback: 7,
    launch: 0,
    knockdown: false,
    meterGain: 8,
    meterCost: 0,
    priority: 1,
    level: "mid",
    cancelRules: ["medium", "heavy", "special", "rising", "breaker"],
    cancelFrame: 6,
    hitboxes: [{ x: 20, y: 70, w: 83, h: 38 }],
    effects: "light-hit",
    events: [],
    ...patch,
  };
}
export function normals(strong = false): Record<string, MoveDefinition> {
  const scale = strong ? 1.2 : 1;
  return {
    light: move("light", {
      damage: Math.floor(48 * scale),
      startupFrames: strong ? 6 : 5,
    }),
    chain2: move("chain2", {
      animation: "medium", state: "LightAttack", damage: Math.floor(58 * scale),
      startupFrames: 6, activeFrames: 4, recoveryFrames: 14,
      knockback: 5, hitstun: 24, cancelRules: [],
      hitboxes: [{ x: 20, y: 65, w: 105, h: 44 }],
    }),
    chain3: move("chain3", {
      animation: "heavy", state: "LightAttack", damage: Math.floor(82 * scale),
      startupFrames: 8, activeFrames: 5, recoveryFrames: 20,
      priority: 2, knockback: 15, hitstun: 27, cancelRules: [],
      hitboxes: [{ x: 20, y: 45, w: 125, h: 50 }], effects: "medium-hit",
    }),
    medium: move("medium", {
      state: "MediumAttack",
      damage: Math.floor(74 * scale),
      startupFrames: 8,
      activeFrames: 4,
      recoveryFrames: 14,
      priority: 2,
      hitstun: 24,
      knockback: 9,
      cancelRules: ["heavy", "special", "rising", "breaker"],
      cancelFrame: 9,
      hitboxes: [{ x: 25, y: 66, w: 107, h: 44 }],
      effects: "medium-hit",
    }),
    heavy: move("heavy", {
      state: "HeavyAttack",
      damage: Math.floor(110 * scale),
      startupFrames: 12,
      activeFrames: 5,
      recoveryFrames: 21,
      priority: 3,
      hitstun: 30,
      knockback: 14,
      launch: 15,
      knockdown: true,
      cancelFrame: 13,
      cancelRules: ["special", "rising", "breaker"],
      hitboxes: [{ x: 25, y: 55, w: 126, h: 55 }],
      effects: "heavy-hit",
    }),
    crouch: move("crouch", {
      state: "CrouchingAttack",
      damage: 65,
      level: "low",
      startupFrames: 7,
      activeFrames: 4,
      recoveryFrames: 15,
      hitboxes: [{ x: 20, y: 10, w: 120, h: 35 }],
      cancelRules: ["special", "breaker"],
      cancelFrame: 8,
    }),
    air: move("air", {
      state: "AirAttack",
      damage: 75,
      level: "high",
      startupFrames: 6,
      activeFrames: 9,
      recoveryFrames: 12,
      hitboxes: [{ x: 10, y: 0, w: 105, h: 70 }],
      cancelRules: [],
    }),
    kick: move("kick", {
      state: "MediumAttack",
      damage: 60,
      startupFrames: 7,
      activeFrames: 4,
      recoveryFrames: 12,
      hitboxes: [{ x: 20, y: 35, w: 113, h: 40 }],
      cancelFrame: 8,
    }),
  };
}

export function basicAttacks(def: import("../types.js").CharacterDefinition, fighter?: import("../types.js").Fighter) {
  if (fighter?.companionVariant !== undefined) return {chain:['pkJab','pkCross','pkFinish'] as [string,string,string],heavy:'ball',kick:'pkFinish',crouch:'pkJab',air:'pkFinish'};
  if (fighter?.weaponUntil && def.weaponAttacks) return def.weaponAttacks;
  return def.basicAttacks ?? { chain: ["light", "chain2", "chain3"], heavy: "heavy", kick: "kick", crouch: "crouch", air: "air" };
}
