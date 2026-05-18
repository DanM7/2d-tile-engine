import type { LevelData } from "./types";
import {
  BLOCKING_TILE_IDS,
  CHIP_TILE_IDS,
  DOOR_TILE_IDS,
  doorToKeyId,
  isDoorTile,
  isKeyTile,
} from "../tile-engine/tiles.js";

const NON_FLOOR = new Set(["empty", ...BLOCKING_TILE_IDS]);

function index(level: LevelData, x: number, y: number): number {
  return y * level.width + x;
}

function cellTile(level: LevelData, layer: "upper" | "lower", x: number, y: number): string {
  const layers = level.layers;
  const arr = layer === "upper" ? layers.upper : layers.lower;
  if (!arr?.length) return "empty";
  return arr[index(level, x, y)] ?? "empty";
}

/** Topmost visible tile at a cell (upper wins when not empty). */
export function getCompositeTile(level: LevelData, x: number, y: number): string {
  const upper = cellTile(level, "upper", x, y);
  if (upper !== "empty") return upper;
  return cellTile(level, "lower", x, y);
}

/** Walkable floor under a collectible or other upper-layer tile. */
export function getFloorTileId(level: LevelData, x: number, y: number): string {
  const lower = cellTile(level, "lower", x, y);
  const upper = cellTile(level, "upper", x, y);
  if (upper !== "empty") {
    return lower !== "empty" ? lower : "empty";
  }
  return lower;
}

export function isBlockedCell(level: LevelData, x: number, y: number): boolean {
  const upper = cellTile(level, "upper", x, y);
  const lower = cellTile(level, "lower", x, y);
  if (DOOR_TILE_IDS.has(upper) || DOOR_TILE_IDS.has(lower)) return true;
  if (BLOCKING_TILE_IDS.has(upper) || BLOCKING_TILE_IDS.has(lower)) return true;
  if (CHIP_TILE_IDS.has(upper)) return false;
  return false;
}

export { doorToKeyId, isDoorTile, isKeyTile };

export function isRenderableFloor(tileId: string): boolean {
  return !NON_FLOOR.has(tileId) || tileId === "empty";
}

/** Remove a tile from either layer at a cell. */
export function removeTileAt(
  level: LevelData,
  x: number,
  y: number,
  tileId: string,
): boolean {
  const i = index(level, x, y);
  let removed = false;
  if (level.layers.upper[i] === tileId) {
    level.layers.upper[i] = "empty";
    removed = true;
  }
  if (level.layers.lower[i] === tileId) {
    level.layers.lower[i] = "empty";
    removed = true;
  }
  return removed;
}

/** Remove a collectible tile from the map (e.g. chip or key picked up). */
export function removeCollectibleAt(
  level: LevelData,
  x: number,
  y: number,
  tileId = "chip",
): boolean {
  return removeTileAt(level, x, y, tileId);
}

export function tileDisplayColor(tileId: string): number {
  if (tileId === "wall" || tileId === "wall_appearing" || tileId === "invisible_wall") {
    return 0x4a4a62;
  }
  if (tileId === "water") return 0x2a4a8a;
  if (tileId === "fire") return 0x8a3a2a;
  if (tileId === "chip" || tileId.startsWith("chip_")) return 0x3a5a3a;
  if (tileId === "dirt" || tileId === "gravel") return 0x5a4a3a;
  if (tileId.startsWith("door_")) return 0x6a5a2a;
  if (tileId.startsWith("key_")) return 0x8a8a2a;
  if (tileId === "exit") return 0x2a8a4a;
  return 0x2e2e42;
}
