import { describe, expect, it } from "vitest";
import type { LevelData } from "../engine/types.js";
import { getCompositeTile, cellTile } from "../engine/levelRuntime.js";
import { createMsCc1Monsters, tickMsCc1Monsters } from "../engine/msCc1/msCc1Monsters.js";
import { applyButtonPressAt } from "../engine/msCc1/msCc1Buttons.js";
import { openTrapFromTrapStep } from "../engine/msCc1/msCc1Traps.js";

function levelFromGrid(
  cells: Record<string, string>,
  width = 8,
  height = 8,
  trapLinks: LevelData["trapLinks"] = [],
): LevelData {
  const upper = Array.from({ length: width * height }, () => "empty");
  const lower = Array.from({ length: width * height }, () => "empty");
  for (const [key, tile] of Object.entries(cells)) {
    const [xs, ys] = key.split(",");
    const x = Number(xs);
    const y = Number(ys);
    upper[y * width + x] = tile;
  }
  return {
    id: "test",
    name: "test",
    width,
    height,
    tileSize: 32,
    layers: { upper, lower },
    playerStart: { x: 0, y: 0 },
    trapLinks,
    monsters: [{ x: 3, y: 3, direction: "north" }],
  };
}

describe("msCc1Traps", () => {
  it("parks the glider on the first brown button at level start", () => {
    const level = levelFromGrid(
      {
        "1,1": "button_brown",
        "3,1": "trap",
        "3,3": "ghost_n",
      },
      8,
      8,
      [{ button: { x: 1, y: 1 }, trap: { x: 3, y: 1 } }],
    );
    const monsters = createMsCc1Monsters(level);
    const glider = monsters.find((m) => m.kind === "ghost");
    expect(glider?.x).toBe(1);
    expect(glider?.y).toBe(1);
    expect(cellTile(level, "lower", 1, 1)).toBe("button_brown");
  });

  it("stepping a trap moves the glider to the next brown button", () => {
    const level = levelFromGrid(
      {
        "1,1": "button_brown",
        "3,1": "trap",
        "1,3": "button_brown",
        "3,3": "trap",
        "1,4": "ghost_n",
      },
      8,
      8,
      [
        { button: { x: 1, y: 1 }, trap: { x: 3, y: 1 } },
        { button: { x: 1, y: 3 }, trap: { x: 3, y: 3 } },
      ],
    );
    level.monsters = [{ x: 1, y: 4, direction: "north" }];
    const monsters = createMsCc1Monsters(level);
    const ctx = {
      redButtonArmed: new Set<string>(),
      openTraps: new Set<string>(),
      moveBoundary: 0,
    };
    const changes: { x: number; y: number }[] = [];

    openTrapFromTrapStep(level, 3, 1, monsters, changes, ctx);

    const glider = monsters.find((m) => m.kind === "ghost");
    expect(glider?.x).toBe(1);
    expect(glider?.y).toBe(3);
    expect(ctx.openTraps.has("3,1")).toBe(true);
    expect(getCompositeTile(level, 3, 1)).toBe("trap");
  });

  it("opening the second trap lets the glider move north toward bombs", () => {
    const level =     levelFromGrid(
      {
        "2,1": "wall",
        "2,2": "button_brown",
        "4,2": "trap",
        "2,4": "button_brown",
        "4,4": "trap",
        "2,5": "ghost_n",
      },
      8,
      8,
      [
        { button: { x: 2, y: 2 }, trap: { x: 4, y: 2 } },
        { button: { x: 2, y: 4 }, trap: { x: 4, y: 4 } },
      ],
    );
    level.monsters = [{ x: 2, y: 5, direction: "north" }];
    const monsters = createMsCc1Monsters(level);
    const ctx = {
      redButtonArmed: new Set<string>(),
      openTraps: new Set<string>(),
      moveBoundary: 0,
    };

    openTrapFromTrapStep(level, 4, 2, monsters, [], ctx);
    openTrapFromTrapStep(level, 4, 4, monsters, [], ctx);

    const glider = monsters.find((m) => m.kind === "ghost")!;
    expect(glider.x).toBe(4);
    expect(glider.y).toBe(4);

    tickMsCc1Monsters(level, monsters, { x: 0, y: 0 }, 0, undefined, ctx);

    expect(glider.alive).toBe(true);
    expect(glider.y).toBeLessThan(4);
  });
});
