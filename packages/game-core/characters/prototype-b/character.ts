import type { CharacterDefinition } from "../../types.js";
import { moves } from "./moves.js";
export const character: CharacterDefinition = {
  id: "prototype-b",
  displayName: "BRUT",
  description: "Power · Pressure & impact",
  color: "#e89778",
  stats: {
    maxHealth: 1400,
    walkSpeed: 4,
    backwardSpeed: 3,
    jumpVelocity: 21,
    gravity: 1,
    weight: 115,
  },
  moves,
  superButtons: ["juggernaut", "quake"],
  specialButtons: ["special", "breaker"],
  specialMoves: [
    { motion: "214", move: "breaker" },
    { motion: "236", move: "special" },
  ],
  animations: Object.fromEntries(
    Object.keys(moves).map((id) => [id, { kind: "procedural", duration: 35 }]),
  ),
  sounds: { hit: "impact", special: "energy" },
  effects: { hit: "heavy-hit" },
  assets: {},
  states: {},
};
