import { describe, expect, it } from "vitest";
import {
  doorToKeyId,
  getFloorTileId,
  getCompositeTile,
  isBlockedCell,
  isDoorTile,
  removeCollectibleAt,
  removeTileAt,
} from "../src/engine/levelRuntime.js";
import type { LevelData } from "../src/engine/types.js";

function cellLevel(upper: string[], lower: string[]): LevelData {
  return {
    id: "test",
    name: "test",
    width: 1,
    height: 1,
    layers: { upper, lower },
  };
}

describe("levelRuntime", () => {
  it("getFloorTileId returns lower layer under a chip", () => {
    const level = cellLevel(["chip"], ["empty"]);
    expect(getFloorTileId(level, 0, 0)).toBe("empty");
  });

  it("removeCollectibleAt reveals empty floor composite", () => {
    const level = cellLevel(["chip"], ["empty"]);
    removeCollectibleAt(level, 0, 0, "chip");
    expect(getCompositeTile(level, 0, 0)).toBe("empty");
    expect(getFloorTileId(level, 0, 0)).toBe("empty");
  });

  it("doors block movement and map to key ids", () => {
    const level = cellLevel(["door_blue"], ["empty"]);
    expect(isDoorTile("door_blue")).toBe(true);
    expect(doorToKeyId("door_blue")).toBe("key_blue");
    expect(isBlockedCell(level, 0, 0)).toBe(true);
    removeTileAt(level, 0, 0, "door_blue");
    expect(getCompositeTile(level, 0, 0)).toBe("empty");
    expect(isBlockedCell(level, 0, 0)).toBe(false);
  });
});
