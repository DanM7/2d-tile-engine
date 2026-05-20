import { describe, expect, it } from "vitest";
import type { LevelData } from "../engine/types.js";
import { cellTile, getCompositeTile } from "../engine/levelRuntime.js";
import {
  tryMsCc1Move,
  msCc1StateFromRun,
  MS_DEATH_NO_FIRE_BOOTS,
  MS_DEATH_NO_FLIPPERS,
} from "../engine/msCc1/msCc1Movement.js";

function levelFromGrid(
  cells: Record<string, string>,
  width = 5,
  height = 5,
  lowerCells: Record<string, string> = {},
): LevelData {
  const upper = Array.from({ length: width * height }, () => "empty");
  const lower = Array.from({ length: width * height }, () => "empty");
  for (const [key, tile] of Object.entries(cells)) {
    const [xs, ys] = key.split(",");
    const x = Number(xs);
    const y = Number(ys);
    upper[y * width + x] = tile;
  }
  for (const [key, tile] of Object.entries(lowerCells)) {
    const [xs, ys] = key.split(",");
    const x = Number(xs);
    const y = Number(ys);
    lower[y * width + x] = tile;
  }
  return {
    id: "test",
    name: "test",
    width,
    height,
    tileSize: 32,
    layers: { upper, lower },
    playerStart: { x: 0, y: 0 },
  };
}

describe("tryMsCc1Move", () => {
  it("opens socket only when no chips remain on the map", () => {
    const level = levelFromGrid({
      "0,0": "chip_s",
      "1,0": "socket",
    });
    let pos = { x: 0, y: 0 };
    let state = msCc1StateFromRun([], 1);

    let r = tryMsCc1Move(level, pos, "right", state);
    expect(r.moved).toBe(false);

    state = msCc1StateFromRun([], 0);
    r = tryMsCc1Move(level, pos, "right", state);
    expect(r.moved).toBe(true);
    expect(getCompositeTile(level, 1, 0)).toBe("empty");
  });

  it("slides on ice without skates until floor", () => {
    const level = levelFromGrid({
      "0,1": "chip_s",
      "1,1": "ice",
      "2,1": "ice",
      "3,1": "empty",
    });
    const state = msCc1StateFromRun([], 0);
    const r = tryMsCc1Move(level, { x: 0, y: 1 }, "right", state);
    expect(r.moved).toBe(true);
    expect(r.position).toEqual({ x: 3, y: 1 });
    expect(r.steps.length).toBe(3);
  });

  it("turns at ice corners along a C-shaped path", () => {
    const level = levelFromGrid(
      {
        "4,13": "chip_s",
        "3,13": "ice",
        "2,13": "ice",
        "1,13": "ice_se",
        "1,14": "ice",
        "1,15": "ice",
        "1,16": "ice_ne",
        "2,16": "ice",
        "3,16": "ice",
        "4,16": "empty",
      },
      6,
      17,
    );
    const state = msCc1StateFromRun([], 0);
    const r = tryMsCc1Move(level, { x: 4, y: 13 }, "left", state);
    expect(r.moved).toBe(true);
    expect(r.position).toEqual({ x: 4, y: 16 });
    expect(r.steps.filter((s) => s.moved).length).toBeGreaterThan(3);
  });

  it("does not slide on ice with ice skates", () => {
    const level = levelFromGrid({
      "0,1": "chip_s",
      "1,1": "ice",
      "2,1": "empty",
    });
    const state = msCc1StateFromRun([], 0, ["ice_skates"]);
    const r = tryMsCc1Move(level, { x: 0, y: 1 }, "right", state);
    expect(r.position).toEqual({ x: 1, y: 1 });
  });

  it("slides on force floor without suction boots", () => {
    const level = levelFromGrid({
      "0,1": "chip_s",
      "1,1": "force_e",
      "2,1": "force_e",
      "3,1": "empty",
    });
    const state = msCc1StateFromRun([], 0);
    const r = tryMsCc1Move(level, { x: 0, y: 1 }, "right", state);
    expect(r.position).toEqual({ x: 3, y: 1 });
  });

  it("does not slide on force floor with suction boots", () => {
    const level = levelFromGrid({
      "0,1": "chip_s",
      "1,1": "force_e",
      "2,1": "empty",
    });
    const state = msCc1StateFromRun([], 0, ["suction_boots"]);
    const r = tryMsCc1Move(level, { x: 0, y: 1 }, "right", state);
    expect(r.position).toEqual({ x: 1, y: 1 });
  });

  it("completes level on exit when chips remaining is zero", () => {
    const level = levelFromGrid({
      "0,0": "chip_s",
      "0,1": "exit",
    });
    const state = msCc1StateFromRun([], 0);
    const r = tryMsCc1Move(level, { x: 0, y: 0 }, "down", state);
    expect(r.moved).toBe(true);
    expect(r.completedLevel).toBe(true);
  });

  it("blocks exit while chips remain on the map", () => {
    const level = levelFromGrid({
      "0,0": "chip_s",
      "0,1": "exit",
      "1,0": "chip",
    });
    const state = msCc1StateFromRun([], 1);
    const r = tryMsCc1Move(level, { x: 0, y: 0 }, "down", state);
    expect(r.moved).toBe(false);
    expect(r.completedLevel).toBe(false);
  });

  it("LESSON 2 layout: push west from Chip start into water", () => {
    const level = levelFromGrid(
      {
        "20,12": "block_movable",
        "21,12": "chip_s",
      },
      32,
      32,
      { "19,12": "water" },
    );
    const r = tryMsCc1Move(level, { x: 21, y: 12 }, "left", msCc1StateFromRun([], 4));
    expect(r.moved).toBe(true);
    expect(r.position).toEqual({ x: 20, y: 12 });
    expect(getCompositeTile(level, 19, 12)).toBe("dirt");
    expect(cellTile(level, "lower", 19, 12)).toBe("water");
    expect(getCompositeTile(level, 20, 12)).toBe("empty");
  });

  it("pushes a block into water and leaves wet dirt (water under dirt)", () => {
    const level = levelFromGrid(
      {
        "0,0": "chip_s",
        "1,0": "block_movable",
      },
      5,
      5,
      { "2,0": "water" },
    );
    const state = msCc1StateFromRun([], 0);
    const r = tryMsCc1Move(level, { x: 0, y: 0 }, "right", state);
    expect(r.moved).toBe(true);
    expect(r.position).toEqual({ x: 1, y: 0 });
    expect(getCompositeTile(level, 1, 0)).toBe("empty");
    expect(getCompositeTile(level, 2, 0)).toBe("dirt");
    expect(cellTile(level, "lower", 2, 0)).toBe("water");
  });

  it("dries wet dirt to floor when Chip steps on it and stays dry after leaving", () => {
    const level = levelFromGrid(
      {
        "0,0": "chip_s",
        "1,0": "dirt",
      },
      5,
      5,
      { "1,0": "water" },
    );
    let r = tryMsCc1Move(level, { x: 0, y: 0 }, "right", msCc1StateFromRun([], 0));
    expect(r.moved).toBe(true);
    expect(getCompositeTile(level, 1, 0)).toBe("empty");
    expect(cellTile(level, "lower", 1, 0)).toBe("empty");

    r = tryMsCc1Move(level, { x: 1, y: 0 }, "left", msCc1StateFromRun([], 0));
    expect(r.moved).toBe(true);
    expect(getCompositeTile(level, 1, 0)).toBe("empty");
  });

  it("does not push a block onto wet dirt", () => {
    const level = levelFromGrid(
      {
        "0,0": "chip_s",
        "1,0": "block_movable",
        "2,0": "dirt",
      },
      5,
      5,
      { "2,0": "water" },
    );
    const r = tryMsCc1Move(level, { x: 0, y: 0 }, "right", msCc1StateFromRun([], 0));
    expect(r.moved).toBe(false);
    expect(getCompositeTile(level, 2, 0)).toBe("dirt");
  });

  it("does not push a block onto placed dirt", () => {
    const level = levelFromGrid({
      "0,0": "chip_s",
      "1,0": "block_movable",
      "2,0": "dirt",
    });
    const r = tryMsCc1Move(level, { x: 0, y: 0 }, "right", msCc1StateFromRun([], 0));
    expect(r.moved).toBe(false);
    expect(getCompositeTile(level, 2, 0)).toBe("dirt");
  });

  it("does not push a block into a wall", () => {
    const level = levelFromGrid({
      "0,0": "chip_s",
      "1,0": "block_movable",
      "2,0": "wall",
    });
    const state = msCc1StateFromRun([], 0);
    const r = tryMsCc1Move(level, { x: 0, y: 0 }, "right", state);
    expect(r.moved).toBe(false);
    expect(getCompositeTile(level, 1, 0)).toBe("block_movable");
  });

  it("clears chip_s start marker when Chip leaves the cell", () => {
    const level = levelFromGrid(
      {
        "5,5": "chip_s",
      },
      32,
      32,
    );
    const r = tryMsCc1Move(level, { x: 5, y: 5 }, "right", msCc1StateFromRun([], 0));
    expect(r.moved).toBe(true);
    expect(getCompositeTile(level, 5, 5)).toBe("empty");
  });

  it("drowns on water without flippers and leaves chip_drowning splash", () => {
    const level = levelFromGrid({
      "0,0": "chip_s",
      "1,0": "water",
    });
    const r = tryMsCc1Move(level, { x: 0, y: 0 }, "right", msCc1StateFromRun([], 0));
    expect(r.moved).toBe(true);
    expect(r.playerDied).toBe(true);
    expect(r.deathMessage).toBe(MS_DEATH_NO_FLIPPERS);
    expect(getCompositeTile(level, 1, 0)).toBe("chip_drowning");
  });

  it("burns on fire without fire boots and leaves chip_burned splash", () => {
    const level = levelFromGrid({
      "0,0": "chip_s",
      "1,0": "fire",
    });
    const r = tryMsCc1Move(level, { x: 0, y: 0 }, "right", msCc1StateFromRun([], 0));
    expect(r.moved).toBe(true);
    expect(r.playerDied).toBe(true);
    expect(r.deathMessage).toBe(MS_DEATH_NO_FIRE_BOOTS);
    expect(getCompositeTile(level, 1, 0)).toBe("chip_burned");
  });

  it("walks on fire with fire boots", () => {
    const level = levelFromGrid({
      "0,0": "chip_s",
      "1,0": "fire",
    });
    const r = tryMsCc1Move(
      level,
      { x: 0, y: 0 },
      "right",
      msCc1StateFromRun([], 0, ["fire_boots"]),
    );
    expect(r.moved).toBe(true);
    expect(r.playerDied).toBeFalsy();
    expect(getCompositeTile(level, 1, 0)).toBe("fire");
  });

  it("swims on water with flippers", () => {
    const level = levelFromGrid({
      "0,0": "chip_s",
      "1,0": "water",
    });
    const r = tryMsCc1Move(
      level,
      { x: 0, y: 0 },
      "right",
      msCc1StateFromRun([], 0, ["flippers"]),
    );
    expect(r.moved).toBe(true);
    expect(r.playerDied).toBeFalsy();
    expect(getCompositeTile(level, 1, 0)).toBe("water");
  });

  it("raises a permanent wall when Chip steps on pass-once (hint_tile / MS $2E)", () => {
    const level = levelFromGrid({
      "0,1": "chip_s",
      "1,1": "hint_tile",
    });
    const r = tryMsCc1Move(level, { x: 0, y: 1 }, "right", msCc1StateFromRun([], 0));
    expect(r.moved).toBe(true);
    expect(getCompositeTile(level, 1, 1)).toBe("wall");
    expect(r.cellChanges).toContainEqual({
      x: 1,
      y: 1,
      removedTileId: "hint_tile",
      placedTileId: "wall",
    });
  });

  it("raises a permanent wall when Chip steps on wall_appearing", () => {
    const level = levelFromGrid({
      "0,1": "chip_s",
      "1,1": "wall_appearing",
    });
    const r = tryMsCc1Move(level, { x: 0, y: 1 }, "right", msCc1StateFromRun([], 0));
    expect(r.moved).toBe(true);
    expect(r.position).toEqual({ x: 1, y: 1 });
    expect(getCompositeTile(level, 1, 1)).toBe("wall");
    expect(r.cellChanges).toContainEqual({
      x: 1,
      y: 1,
      removedTileId: "wall_appearing",
      placedTileId: "wall",
    });

    const stepOff = tryMsCc1Move(level, { x: 1, y: 1 }, "left", msCc1StateFromRun([], 0));
    expect(stepOff.moved).toBe(true);
    expect(getCompositeTile(level, 1, 1)).toBe("wall");

    const blockedBack = tryMsCc1Move(
      level,
      { x: 0, y: 1 },
      "right",
      msCc1StateFromRun([], 0),
    );
    expect(blockedBack.moved).toBe(false);
  });

  it("thief removes all boots but keeps keys", () => {
    const level = levelFromGrid({
      "0,0": "chip_s",
      "1,0": "thief",
    });
    const state = msCc1StateFromRun(
      ["key_red"],
      0,
      ["flippers", "fire_boots", "ice_skates", "suction_boots"],
    );
    const r = tryMsCc1Move(level, { x: 0, y: 0 }, "right", state);
    expect(r.moved).toBe(true);
    expect(r.state.tools).toEqual([]);
    expect(r.state.keys).toEqual(["key_red"]);
    expect(getCompositeTile(level, 1, 0)).toBe("thief");
  });

  it("does not consume green keys for multiple green doors", () => {
    const level = levelFromGrid({
      "0,0": "chip_s",
      "1,0": "key_green",
      "2,0": "door_green",
      "3,0": "door_green",
    });
    let pos = { x: 0, y: 0 };
    let state = msCc1StateFromRun([], 0);

    let r = tryMsCc1Move(level, pos, "right", state);
    pos = r.position;
    state = r.state;
    expect(state.keys).toContain("key_green");

    r = tryMsCc1Move(level, pos, "right", state);
    pos = r.position;
    state = r.state;
    expect(state.keys).toContain("key_green");

    r = tryMsCc1Move(level, pos, "right", state);
    state = r.state;
    expect(state.keys).toContain("key_green");
  });
});
