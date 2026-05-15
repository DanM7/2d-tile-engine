import type { LevelData } from "./types.js";
import { getCompositeTile } from "./levelRuntime.js";

const DEFAULT_COLLECTIBLE_TILE_IDS = new Set(["chip"]);

/** Count pickup collectibles still on the map (e.g. MS chip tiles). */
export function countCollectiblesOnMap(
  level: LevelData,
  tileIds: Set<string> = DEFAULT_COLLECTIBLE_TILE_IDS,
): number {
  let count = 0;
  for (let y = 0; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) {
      if (tileIds.has(getCompositeTile(level, x, y))) {
        count++;
      }
    }
  }
  return count;
}
