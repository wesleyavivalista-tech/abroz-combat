import type { CharacterDefinition } from "../../types.js";
import { moves } from "./moves.js";
export const character: CharacterDefinition = {
  id: "prototype-a",
  displayName: "VECTOR",
  description: "Balanced · Precision & range",
  color: "#c6e977",
  stats: {
    maxHealth: 1400,
    walkSpeed: 5,
    backwardSpeed: 4,
    jumpVelocity: 22,
    gravity: 1,
    weight: 100,
  },
  moves,
  superButtons: ["nova", "skybreak"],
  specialButtons: ["special", "rising"],
  specialMoves: [
    { motion: "623", move: "rising" },
    { motion: "236", move: "special" },
  ],
  animations: Object.fromEntries(
    Object.keys(moves).map((id) => [id, { kind: "procedural", duration: 30 }]),
  ),
  sounds: { hit: "impact", special: "energy" },
  effects: { hit: "light-hit" },
  assets: {},
  states: {},
};
