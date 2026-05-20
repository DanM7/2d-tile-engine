import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { cellTile } from "../engine/levelRuntime.js";
import type { LevelData } from "../engine/types.js";
import { createMsCc1Monsters } from "../engine/msCc1/msCc1Monsters.js";

import { fileURLToPath } from "node:url";
import path from "node:path";

const LEVEL_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../chips-challenge-web/apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-005.json",
);

describe("level-005 glider", () => {
  it("parks glider on first brown button from real level JSON", () => {
    const level = JSON.parse(readFileSync(LEVEL_PATH, "utf8")) as LevelData;
    normalizeLevelLayers(level);
    expect(level.trapLinks?.length).toBeGreaterThan(0);

    const monsters = createMsCc1Monsters(level);
    const glider = monsters.find((m) => m.alive && m.kind === "ghost");
    expect(glider, "ghost monster").toBeDefined();
    expect(glider!.x).toBe(16);
    expect(glider!.y).toBe(7);
    expect(cellTile(level, "upper", 16, 7)).toMatch(/^ghost_/);
    expect(cellTile(level, "lower", 16, 7)).toBe("button_brown");
  });
});
