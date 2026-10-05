import type { Fighter, StageDefinition } from "../types.js";

/** Platforms are one-way: ascend through them and land on their top surface. */
export function surfaceBelow(
  stage: StageDefinition,
  x: number,
  y: number,
): number {
  let height = stage.floorHeight;
  for (const platform of stage.platforms ?? []) {
    if (x >= platform.x && x <= platform.x + platform.width && platform.y <= y)
      height = Math.max(height, platform.y);
  }
  return height;
}

export function grounded(f: Fighter, stage: StageDefinition): boolean {
  return f.vy === 0 && f.y === surfaceBelow(stage, f.x, f.y);
}
