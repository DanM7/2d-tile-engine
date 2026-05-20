import {
  cellTile,
  removeTileAt,
  setLowerTile,
  setUpperTile,
} from "../levelRuntime.js";
import type { LevelData } from "../types.js";
import type { MsCc1CellChange } from "./types.js";
import type { MsCc1MonsterState } from "./msCc1Monsters.js";
import type { MsCc1ButtonPressContext } from "./msCc1Buttons.js";
import { monsterTileId, type MonsterFacing } from "./monsterDirection.js";

export const TRAP_TILE_ID = "trap";

export function trapCellKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function isTrapCell(level: LevelData, x: number, y: number): boolean {
  return (
    cellTile(level, "upper", x, y) === TRAP_TILE_ID ||
    cellTile(level, "lower", x, y) === TRAP_TILE_ID
  );
}

export function isTrapOpen(
  ctx: Pick<MsCc1ButtonPressContext, "openTraps">,
  x: number,
  y: number,
): boolean {
  return ctx.openTraps.has(trapCellKey(x, y));
}

/** Closed traps block movement; open traps are passable (MS acting floor). */
export function isClosedTrapAt(
  level: LevelData,
  x: number,
  y: number,
  ctx: Pick<MsCc1ButtonPressContext, "openTraps">,
): boolean {
  return isTrapCell(level, x, y) && !isTrapOpen(ctx, x, y);
}

function findTrapLinkByButton(level: LevelData, buttonX: number, buttonY: number) {
  return level.trapLinks?.find(
    (link) => link.button.x === buttonX && link.button.y === buttonY,
  );
}

function findTrapLinkByTrap(level: LevelData, trapX: number, trapY: number) {
  return level.trapLinks?.find(
    (link) => link.trap.x === trapX && link.trap.y === trapY,
  );
}

function recordTrapOpened(cellChanges: MsCc1CellChange[], x: number, y: number): void {
  cellChanges.push({ x, y, placedTileId: TRAP_TILE_ID });
}

/** Teleport a creature onto a cell (trap / brown-button choreography). */
export function teleportMonster(
  level: LevelData,
  monster: MsCc1MonsterState,
  toX: number,
  toY: number,
  facing: MonsterFacing,
  cellChanges: MsCc1CellChange[],
): void {
  if (!monster.alive) {
    return;
  }

  const fromX = monster.x;
  const fromY = monster.y;
  const oldTile = monster.tileId;

  if (fromX === toX && fromY === toY && monster.direction === facing) {
    return;
  }

  removeTileAt(level, fromX, fromY, oldTile);
  cellChanges.push({ x: fromX, y: fromY, removedTileId: oldTile });

  const destUpper = cellTile(level, "upper", toX, toY);
  if (destUpper === "button_brown") {
    setLowerTile(level, toX, toY, "button_brown");
  } else if (isTrapCell(level, toX, toY)) {
    setLowerTile(level, toX, toY, TRAP_TILE_ID);
    const i = toY * level.width + toX;
    if (level.layers.upper[i] === TRAP_TILE_ID) {
      level.layers.upper[i] = "empty";
    }
  }

  const newTile = monsterTileId(monster.kind, facing);
  setUpperTile(level, toX, toY, newTile);
  cellChanges.push({ x: toX, y: toY, placedTileId: newTile });

  monster.x = toX;
  monster.y = toY;
  monster.direction = facing;
  monster.tileId = newTile;
}

function findGliderMonster(
  level: LevelData,
  monsters: MsCc1MonsterState[],
): MsCc1MonsterState | undefined {
  const listed = monsters.find((m) => m.alive && m.kind === "ghost");
  if (listed) {
    return listed;
  }
  for (let y = 0; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) {
      const tileId = cellTile(level, "upper", x, y);
      if (!tileId.startsWith("ghost_")) {
        continue;
      }
      const at = monsters.find((m) => m.alive && m.x === x && m.y === y);
      if (at) {
        return at;
      }
    }
  }
  return undefined;
}

/** Park the lesson glider on the first brown button (large brown dot). */
export function parkGliderOnFirstBrownButton(
  level: LevelData,
  monsters: MsCc1MonsterState[],
): void {
  const link = level.trapLinks?.[0];
  const glider = findGliderMonster(level, monsters);
  if (!link || !glider) {
    return;
  }
  teleportMonster(level, glider, link.button.x, link.button.y, "north", []);
}

function advanceGliderAfterTrapOpened(
  level: LevelData,
  openedLink: NonNullable<LevelData["trapLinks"]>[number],
  linkIndex: number,
  monsters: MsCc1MonsterState[],
  cellChanges: MsCc1CellChange[],
): void {
  const glider = monsters.find((m) => m.alive && m.kind === "ghost");
  if (!glider || !level.trapLinks || level.trapLinks.length < 2) {
    return;
  }

  if (linkIndex === 0) {
    const nextButton = level.trapLinks[1]!.button;
    teleportMonster(
      level,
      glider,
      nextButton.x,
      nextButton.y,
      "north",
      cellChanges,
    );
    return;
  }

  if (linkIndex === 1) {
    teleportMonster(
      level,
      glider,
      openedLink.trap.x,
      openedLink.trap.y,
      "north",
      cellChanges,
    );
  }
}

/**
 * MS: brown button opens its linked trap (tile stays; marked open in ctx).
 * Lesson 5: advances the glider between brown buttons / onto the second trap.
 */
export function openTrapForBrownButton(
  level: LevelData,
  buttonX: number,
  buttonY: number,
  monsters: MsCc1MonsterState[],
  cellChanges: MsCc1CellChange[],
  ctx: MsCc1ButtonPressContext,
): boolean {
  const link = findTrapLinkByButton(level, buttonX, buttonY);
  if (!link) {
    return false;
  }
  return openLinkedTrap(level, link, monsters, cellChanges, ctx);
}

/** Stepping a trap tile opens it via its linked brown button (MS lesson 5). */
export function openTrapFromTrapStep(
  level: LevelData,
  trapX: number,
  trapY: number,
  monsters: MsCc1MonsterState[],
  cellChanges: MsCc1CellChange[],
  ctx: MsCc1ButtonPressContext,
): boolean {
  const link = findTrapLinkByTrap(level, trapX, trapY);
  if (!link) {
    return false;
  }
  return openLinkedTrap(level, link, monsters, cellChanges, ctx);
}

function openLinkedTrap(
  level: LevelData,
  link: NonNullable<LevelData["trapLinks"]>[number],
  monsters: MsCc1MonsterState[],
  cellChanges: MsCc1CellChange[],
  ctx: MsCc1ButtonPressContext,
): boolean {
  const { x, y } = link.trap;
  if (!isTrapCell(level, x, y)) {
    return false;
  }

  const key = trapCellKey(x, y);
  if (ctx.openTraps.has(key)) {
    return false;
  }

  ctx.openTraps.add(key);
  recordTrapOpened(cellChanges, x, y);

  const linkIndex =
    level.trapLinks?.findIndex(
      (l) => l.button.x === link.button.x && l.button.y === link.button.y,
    ) ?? -1;

  advanceGliderAfterTrapOpened(level, link, linkIndex, monsters, cellChanges);

  return true;
}

/** Brown button under a creature (lower) or on the surface (upper). */
export function brownButtonTileAt(level: LevelData, x: number, y: number): string | null {
  const lower = cellTile(level, "lower", x, y);
  if (lower === "button_brown") {
    return lower;
  }
  const upper = cellTile(level, "upper", x, y);
  if (upper === "button_brown") {
    return upper;
  }
  return null;
}
