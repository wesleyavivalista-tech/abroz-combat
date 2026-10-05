import type { CharacterDefinition } from "../types.js";
export interface FighterSkin { id: string; name: string }
const original: readonly FighterSkin[] = [{ id: "original", name: "Original" }];
export function fighterSkins(character: CharacterDefinition): readonly FighterSkin[] {
  return character.skins ?? original;
}
export function resolveSkin(character: CharacterDefinition, requested?: string): string {
  const skins = fighterSkins(character);
  const id = requested ?? skins[0]?.id;
  if (!skins.some(s => s.id === id)) throw new Error("Unknown skin for " + character.id);
  return id!;
}
