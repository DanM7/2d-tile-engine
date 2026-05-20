import type { Direction, LevelData } from "../types.js";
import {
  cellTile,
  doorToKeyId,
  dryDirtCell,
  getCompositeTile,
  isBlockedCell,
  isDirtCell,
  isDoorTile,
  isKeyConsumedWhenOpeningDoor,
  isKeyTile,
  isSocketTile,
  isWetDirtCell,
  removeCollectibleAt,
  removeTileAt,
  setUpperTile,
} from "../levelRuntime.js";
import {
  BLOCK_MOVABLE_TILE_ID,
  CHIP_BURNED_TILE_ID,
  CHIP_DROWNING_TILE_ID,
  CHIP_TILE_IDS,
  COLLECTIBLE_CHIP_TILE_ID,
  FIRE_BOOTS_TILE_ID,
  FLIPPERS_TILE_ID,
  isBlockTile,
  isMonsterTile,
  SOCKET_TILE_ID,
  TOOL_TILE_IDS,
  MS_POPUP_WALL_TILE_IDS,
} from "../../tile-engine/tiles.js";
import { MS_DEATH_CREATURES } from "./msCc1Monsters.js";
import { slideDirectionAfterLanding } from "./msCc1Sliding.js";
import {
  isFunctioningTeleportAt,
  isNonFunctioningTeleportAt,
  resolveBlueTeleport,
} from "./msCc1Teleports.js";
import type { MsCc1ButtonPressContext } from "./msCc1Buttons.js";
import type {
  MsCc1CellChange,
  MsCc1MoveResult,
  MsCc1MoveStep,
  MsCc1PlayerState,
} from "./types.js";

export type { MsCc1MoveStep } from "./types.js";

const EXIT_TILE_IDS = new Set(["exit", "chip_exit", "exit_3a", "exit_3b"]);

/** MS death message when stepping on water without flippers. */
export const MS_DEATH_NO_FLIPPERS = "Ooops! Chip can't swim without flippers!";

/** MS death message when stepping on fire without fire boots (CHIPS.EXE). */
export const MS_DEATH_NO_FIRE_BOOTS =
  "Ooops! Don't step in the fire without fire boots!";

export const THIEF_TILE_ID = "thief";

export function isExitTile(tileId: string): boolean {
  return EXIT_TILE_IDS.has(tileId);
}

function directionDelta(direction: Direction): { dx: number; dy: number } {
  switch (direction) {
    case "up":
      return { dx: 0, dy: -1 };
    case "down":
      return { dx: 0, dy: 1 };
    case "left":
      return { dx: -1, dy: 0 };
    case "right":
      return { dx: 1, dy: 0 };
  }
}

function hasKey(state: MsCc1PlayerState, keyId: string): boolean {
  return state.keys.includes(keyId);
}

function hasFlippers(state: MsCc1PlayerState): boolean {
  return state.tools.includes(FLIPPERS_TILE_ID);
}

function hasFireBoots(state: MsCc1PlayerState): boolean {
  return state.tools.includes(FIRE_BOOTS_TILE_ID);
}

function isFireCell(level: LevelData, x: number, y: number): boolean {
  return getCompositeTile(level, x, y) === "fire";
}

function consumeKey(state: MsCc1PlayerState, keyId: string): void {
  const index = state.keys.indexOf(keyId);
  if (index >= 0) {
    state.keys.splice(index, 1);
  }
}

function tryAddKey(state: MsCc1PlayerState, keyId: string): boolean {
  if (!isKeyTile(keyId) || state.keys.includes(keyId)) {
    return false;
  }
  state.keys.push(keyId);
  return true;
}

function tryAddTool(state: MsCc1PlayerState, toolId: string): boolean {
  if (!TOOL_TILE_IDS.has(toolId) || state.tools.includes(toolId)) {
    return false;
  }
  state.tools.push(toolId);
  return true;
}

function recordRemoval(
  cellChanges: MsCc1CellChange[],
  x: number,
  y: number,
  tileId: string,
): void {
  cellChanges.push({ x, y, removedTileId: tileId });
}

function isWaterCell(level: LevelData, x: number, y: number): boolean {
  return getCompositeTile(level, x, y) === "water";
}

/** MS: leaving a cell clears the Chip facing marker (`chip_n` / `chip_s` / …) on the floor. */
/** MS: Chip turns dirt (and underlying water) into permanent floor when stepping on it. */
function dryDirtUnderChip(
  level: LevelData,
  x: number,
  y: number,
  cellChanges: MsCc1CellChange[],
): void {
  if (!isDirtCell(level, x, y)) {
    return;
  }
  for (const tileId of dryDirtCell(level, x, y)) {
    recordRemoval(cellChanges, x, y, tileId);
  }
}

/** MS pass-once / pop-up wall ($2E) and invisible wall appearing ($2C): become permanent `wall`. */
function applyAppearingWall(
  level: LevelData,
  x: number,
  y: number,
  cellChanges: MsCc1CellChange[],
): void {
  const upper = cellTile(level, "upper", x, y);
  const lower = cellTile(level, "lower", x, y);
  const tileId = MS_POPUP_WALL_TILE_IDS.has(upper)
    ? upper
    : MS_POPUP_WALL_TILE_IDS.has(lower)
      ? lower
      : null;
  if (!tileId) {
    return;
  }
  removeTileAt(level, x, y, tileId);
  setUpperTile(level, x, y, "wall");
  cellChanges.push({
    x,
    y,
    removedTileId: tileId,
    placedTileId: "wall",
  });
}

function clearChipMarkerOnDepart(
  level: LevelData,
  x: number,
  y: number,
  cellChanges: MsCc1CellChange[],
): void {
  const i = y * level.width + x;
  const upper = level.layers.upper[i];
  if (!upper || !CHIP_TILE_IDS.has(upper)) {
    return;
  }
  removeTileAt(level, x, y, upper);
  recordRemoval(cellChanges, x, y, upper);
}

function applyDrowningSplash(
  level: LevelData,
  x: number,
  y: number,
  cellChanges: MsCc1CellChange[],
): void {
  removeTileAt(level, x, y, "water");
  setUpperTile(level, x, y, CHIP_DROWNING_TILE_ID);
  cellChanges.push({
    x,
    y,
    removedTileId: "water",
    placedTileId: CHIP_DROWNING_TILE_ID,
  });
}

function applyFireBurnSplash(
  level: LevelData,
  x: number,
  y: number,
  cellChanges: MsCc1CellChange[],
): void {
  removeTileAt(level, x, y, "fire");
  setUpperTile(level, x, y, CHIP_BURNED_TILE_ID);
  cellChanges.push({
    x,
    y,
    removedTileId: "fire",
    placedTileId: CHIP_BURNED_TILE_ID,
  });
}

/** Where a pushed block may land (MS: water becomes wet dirt; dirt blocks blocks). */
function blockPushDestination(
  level: LevelData,
  x: number,
  y: number,
  chipsLeft: number,
): "floor" | "water" | null {
  const tile = getCompositeTile(level, x, y);
  if (tile === "water") return "water";
  if (isDirtCell(level, x, y) || isWetDirtCell(level, x, y)) return null;
  if (tile === "empty" || tile === "gravel") return "floor";
  if (isBlockTile(tile) || isMonsterTile(tile)) return null;
  if (isDoorTile(tile) || isExitTile(tile)) return null;
  if (isSocketTile(tile) && chipsLeft > 0) return null;
  if (tile === COLLECTIBLE_CHIP_TILE_ID || isKeyTile(tile)) return null;
  if (CHIP_TILE_IDS.has(tile)) return null;
  if (isBlockedCell(level, x, y, { chipsRemainingOnMap: chipsLeft })) {
    return null;
  }
  return null;
}

function tryPushBlock(
  level: LevelData,
  blockX: number,
  blockY: number,
  dx: number,
  dy: number,
  chipsLeft: number,
  cellChanges: MsCc1CellChange[],
): boolean {
  const beyondX = blockX + dx;
  const beyondY = blockY + dy;
  if (beyondX < 0 || beyondX >= level.width || beyondY < 0 || beyondY >= level.height) {
    return false;
  }

  const dest = blockPushDestination(level, beyondX, beyondY, chipsLeft);
  if (!dest) {
    return false;
  }

  recordRemoval(cellChanges, blockX, blockY, BLOCK_MOVABLE_TILE_ID);
  removeTileAt(level, blockX, blockY, BLOCK_MOVABLE_TILE_ID);

  if (dest === "water") {
    // MS wet dirt: dirt on upper; water stays on lower until Chip dries the cell.
    if (cellTile(level, "upper", beyondX, beyondY) === "water") {
      removeTileAt(level, beyondX, beyondY, "water");
    }
    setUpperTile(level, beyondX, beyondY, "dirt");
    cellChanges.push({ x: beyondX, y: beyondY, placedTileId: "dirt" });
  } else {
    setUpperTile(level, beyondX, beyondY, BLOCK_MOVABLE_TILE_ID);
    cellChanges.push({ x: beyondX, y: beyondY, placedTileId: BLOCK_MOVABLE_TILE_ID });
  }

  return true;
}

/** MS thief (spy): steals all boots; keys stay. Thief tile remains on the map. */
function applyThiefSteal(
  level: LevelData,
  x: number,
  y: number,
  state: MsCc1PlayerState,
): void {
  if (getCompositeTile(level, x, y) !== THIEF_TILE_ID) {
    return;
  }
  state.tools = [];
}

function pickUpAt(
  level: LevelData,
  x: number,
  y: number,
  state: MsCc1PlayerState,
  cellChanges: MsCc1CellChange[],
): void {
  const tile = getCompositeTile(level, x, y);

  if (tile === COLLECTIBLE_CHIP_TILE_ID) {
    if (!removeCollectibleAt(level, x, y, COLLECTIBLE_CHIP_TILE_ID)) return;
    recordRemoval(cellChanges, x, y, COLLECTIBLE_CHIP_TILE_ID);
    if (state.chipsRemainingOnMap > 0) {
      state.chipsRemainingOnMap -= 1;
    }
    return;
  }

  if (isKeyTile(tile)) {
    if (!tryAddKey(state, tile)) return;
    if (!removeCollectibleAt(level, x, y, tile)) return;
    recordRemoval(cellChanges, x, y, tile);
    return;
  }

  if (TOOL_TILE_IDS.has(tile)) {
    if (!tryAddTool(state, tile)) return;
    if (!removeCollectibleAt(level, x, y, tile)) return;
    recordRemoval(cellChanges, x, y, tile);
  }
}

function noMove(
  position: { x: number; y: number },
  state: MsCc1PlayerState,
  cellChanges: MsCc1CellChange[],
  direction: Direction,
): MsCc1MoveResult {
  return {
    moved: false,
    position,
    state,
    cellChanges,
    completedLevel: false,
    direction,
    steps: [],
  };
}

function clonePlayerState(state: MsCc1PlayerState): MsCc1PlayerState {
  return {
    keys: [...state.keys],
    tools: [...state.tools],
    chipsRemainingOnMap: state.chipsRemainingOnMap,
  };
}

function completeSuccessfulMove(
  level: LevelData,
  from: { x: number; y: number },
  to: { x: number; y: number },
  state: MsCc1PlayerState,
  cellChanges: MsCc1CellChange[],
  direction: Direction,
): MsCc1MoveResult {
  clearChipMarkerOnDepart(level, from.x, from.y, cellChanges);
  pickUpAt(level, to.x, to.y, state, cellChanges);
  applyThiefSteal(level, to.x, to.y, state);
  applyAppearingWall(level, to.x, to.y, cellChanges);
  dryDirtUnderChip(level, to.x, to.y, cellChanges);

  if (isWaterCell(level, to.x, to.y) && !hasFlippers(state)) {
    applyDrowningSplash(level, to.x, to.y, cellChanges);
    return {
      moved: true,
      position: to,
      state,
      cellChanges,
      completedLevel: false,
      direction,
      playerDied: true,
      deathMessage: MS_DEATH_NO_FLIPPERS,
      steps: [],
    };
  }

  if (isFireCell(level, to.x, to.y) && !hasFireBoots(state)) {
    applyFireBurnSplash(level, to.x, to.y, cellChanges);
    return {
      moved: true,
      position: to,
      state,
      cellChanges,
      completedLevel: false,
      direction,
      playerDied: true,
      deathMessage: MS_DEATH_NO_FIRE_BOOTS,
      steps: [],
    };
  }

  const standingTile = getCompositeTile(level, to.x, to.y);
  const completedLevel = isExitTile(standingTile) && state.chipsRemainingOnMap === 0;

  return {
    moved: true,
    position: to,
    state,
    cellChanges,
    completedLevel,
    direction,
    steps: [],
  };
}

function recordStep(
  from: { x: number; y: number },
  step: MsCc1MoveResult,
  steps: MsCc1MoveStep[],
): void {
  steps.push({
    from,
    to: { ...step.position },
    moved: step.moved,
    direction: step.direction,
    state: clonePlayerState(step.state),
    cellChanges: [...step.cellChanges],
    completedLevel: step.completedLevel,
    playerDied: step.playerDied,
    deathMessage: step.deathMessage,
  });
}

/**
 * One voluntary grid step (no ice/force chain).
 * Mutates `level` layers and returns updated player state.
 */
export function tryMsCc1SingleStep(
  level: LevelData,
  position: { x: number; y: number },
  direction: Direction,
  state: MsCc1PlayerState,
  mechanics?: Pick<MsCc1ButtonPressContext, "openTraps">,
): MsCc1MoveResult {
  const cellChanges: MsCc1CellChange[] = [];
  const nextState = clonePlayerState(state);

  const { dx, dy } = directionDelta(direction);
  const nx = position.x + dx;
  const ny = position.y + dy;

  if (nx < 0 || nx >= level.width || ny < 0 || ny >= level.height) {
    return noMove(position, nextState, cellChanges, direction);
  }

  const destTile = getCompositeTile(level, nx, ny);
  const chipsLeft = nextState.chipsRemainingOnMap;

  if (isMonsterTile(destTile)) {
    clearChipMarkerOnDepart(level, position.x, position.y, cellChanges);
    return {
      moved: true,
      position: { x: nx, y: ny },
      state: nextState,
      cellChanges,
      completedLevel: false,
      direction,
      playerDied: true,
      deathMessage: MS_DEATH_CREATURES,
      steps: [],
    };
  }

  if (isBlockTile(destTile)) {
    if (!tryPushBlock(level, nx, ny, dx, dy, chipsLeft, cellChanges)) {
      return noMove(position, nextState, cellChanges, direction);
    }
    return completeSuccessfulMove(
      level,
      position,
      { x: nx, y: ny },
      nextState,
      cellChanges,
      direction,
    );
  }

  if (isDoorTile(destTile)) {
    const keyId = doorToKeyId(destTile);
    if (!keyId || !hasKey(nextState, keyId)) {
      return noMove(position, nextState, cellChanges, direction);
    }
    if (isKeyConsumedWhenOpeningDoor(keyId)) {
      consumeKey(nextState, keyId);
    }
    removeTileAt(level, nx, ny, destTile);
    recordRemoval(cellChanges, nx, ny, destTile);
  } else if (isSocketTile(destTile)) {
    if (chipsLeft > 0) {
      return noMove(position, nextState, cellChanges, direction);
    }
    removeTileAt(level, nx, ny, SOCKET_TILE_ID);
    recordRemoval(cellChanges, nx, ny, SOCKET_TILE_ID);
  } else if (isExitTile(destTile)) {
    if (chipsLeft > 0) {
      return noMove(position, nextState, cellChanges, direction);
    }
  } else if (
    isBlockedCell(level, nx, ny, {
      chipsRemainingOnMap: chipsLeft,
      openTraps: mechanics?.openTraps,
      allowAppearingWall: true,
    })
  ) {
    return noMove(position, nextState, cellChanges, direction);
  }

  if (CHIP_TILE_IDS.has(destTile)) {
    return noMove(position, nextState, cellChanges, direction);
  }

  return completeSuccessfulMove(
    level,
    position,
    { x: nx, y: ny },
    nextState,
    cellChanges,
    direction,
  );
}

const MAX_SLIDE_STEPS = 64;

function isOnTeleportPad(level: LevelData, x: number, y: number): boolean {
  return (
    isFunctioningTeleportAt(level, x, y) || isNonFunctioningTeleportAt(level, x, y)
  );
}

/** MS blue teleport after stepping onto a pad (warp, ice-through, or bounce). */
function tryTeleportAfterLanding(
  level: LevelData,
  from: { x: number; y: number },
  position: { x: number; y: number },
  entryDirection: Direction,
  state: MsCc1PlayerState,
  cellChanges: MsCc1CellChange[],
  mechanics?: Pick<MsCc1ButtonPressContext, "openTraps">,
): MsCc1MoveResult | null {
  if (!isOnTeleportPad(level, position.x, position.y)) {
    return null;
  }

  const resolution = resolveBlueTeleport(
    level,
    position.x,
    position.y,
    entryDirection,
    state,
    mechanics?.openTraps,
  );

  if (resolution.kind === "bounce") {
    return completeSuccessfulMove(
      level,
      position,
      from,
      state,
      cellChanges,
      entryDirection,
    );
  }

  return completeSuccessfulMove(
    level,
    position,
    { x: resolution.x, y: resolution.y },
    state,
    cellChanges,
    entryDirection,
  );
}

/**
 * MS Chip's Challenge grid step: chips, keys, doors, socket, blocks, exit,
 * then involuntary ice / force-floor slides.
 */
export function tryMsCc1Move(
  level: LevelData,
  position: { x: number; y: number },
  direction: Direction,
  state: MsCc1PlayerState,
  mechanics?: Pick<MsCc1ButtonPressContext, "openTraps">,
): MsCc1MoveResult {
  const steps: MsCc1MoveStep[] = [];
  let pos = { ...position };
  let playerState = clonePlayerState(state);

  const first = tryMsCc1SingleStep(level, pos, direction, playerState, mechanics);
  recordStep(pos, first, steps);
  if (!first.moved) {
    return { ...first, steps };
  }

  let result: MsCc1MoveResult = { ...first, steps };
  pos = { ...first.position };
  playerState = first.state;
  let prevPos = { ...position };

  const firstTeleport = tryTeleportAfterLanding(
    level,
    position,
    pos,
    result.direction,
    playerState,
    result.cellChanges,
    mechanics,
  );
  if (firstTeleport) {
    recordStep(pos, firstTeleport, steps);
    result = {
      ...firstTeleport,
      steps,
      moved: true,
      cellChanges: [...first.cellChanges, ...firstTeleport.cellChanges],
    };
    prevPos = pos;
    pos = { ...firstTeleport.position };
    playerState = firstTeleport.state;
    if (firstTeleport.playerDied || firstTeleport.completedLevel) {
      return result;
    }
  }

  for (let i = 0; i < MAX_SLIDE_STEPS; i++) {
    const teleportStep = tryTeleportAfterLanding(
      level,
      prevPos,
      pos,
      result.direction,
      playerState,
      [],
      mechanics,
    );
    if (teleportStep) {
      recordStep(pos, teleportStep, steps);
      result = {
        moved: true,
        position: teleportStep.position,
        state: teleportStep.state,
        cellChanges: [...result.cellChanges, ...teleportStep.cellChanges],
        completedLevel: teleportStep.completedLevel,
        direction: teleportStep.direction,
        steps,
        playerDied: result.playerDied || teleportStep.playerDied,
        deathMessage: teleportStep.deathMessage ?? result.deathMessage,
      };
      if (teleportStep.playerDied || teleportStep.completedLevel) {
        return result;
      }
      prevPos = pos;
      pos = { ...teleportStep.position };
      playerState = teleportStep.state;
      continue;
    }

    const standing = getCompositeTile(level, pos.x, pos.y);
    const slideDir = slideDirectionAfterLanding(standing, playerState, result.direction);
    if (!slideDir) {
      break;
    }

    const slideStep = tryMsCc1SingleStep(level, pos, slideDir, playerState, mechanics);
    recordStep(pos, slideStep, steps);
    result = {
      moved: result.moved || slideStep.moved,
      position: slideStep.moved ? slideStep.position : result.position,
      state: slideStep.state,
      cellChanges: [...result.cellChanges, ...slideStep.cellChanges],
      completedLevel: slideStep.completedLevel,
      direction: slideStep.direction,
      steps,
      playerDied: result.playerDied || slideStep.playerDied,
      deathMessage: slideStep.deathMessage ?? result.deathMessage,
    };

    if (slideStep.playerDied || slideStep.completedLevel) {
      return result;
    }
    if (!slideStep.moved) {
      break;
    }
    prevPos = pos;
    pos = { ...slideStep.position };
    playerState = slideStep.state;
  }

  return result;
}

/** Build player state from run session counters. */
export function msCc1StateFromRun(
  keys: string[],
  chipsRemainingOnMap: number,
  tools: string[] = [],
): MsCc1PlayerState {
  return { keys: [...keys], tools: [...tools], chipsRemainingOnMap };
}
