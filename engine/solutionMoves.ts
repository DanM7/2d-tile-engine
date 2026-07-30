import type { Direction } from "./types.js";

/** Uppercase move letters stored in cc1-ms-solutions.json `moves` arrays. */
export type SolutionMoveLetter = "U" | "D" | "L" | "R";

const TO_LETTER: Record<Direction, SolutionMoveLetter> = {
  up: "U",
  down: "D",
  left: "L",
  right: "R",
};

const TO_DIRECTION: Record<SolutionMoveLetter, Direction> = {
  U: "up",
  D: "down",
  L: "left",
  R: "right",
};

const LEGACY: Record<string, Direction> = {
  up: "up",
  down: "down",
  left: "left",
  right: "right",
};

export function encodeSolutionMoves(
  moves: readonly (Direction | SolutionMoveLetter)[],
): SolutionMoveLetter[] {
  return moves.map((move) => {
    if (move in TO_DIRECTION) {
      return move as SolutionMoveLetter;
    }
    return TO_LETTER[move as Direction];
  });
}

export function decodeSolutionMoves(moves: readonly string[]): Direction[] {
  return moves.map((move) => {
    const fromLetter = TO_DIRECTION[move as SolutionMoveLetter];
    if (fromLetter) {
      return fromLetter;
    }
    const legacy = LEGACY[move];
    if (legacy) {
      return legacy;
    }
    throw new Error(`Invalid solution move: ${move}`);
  });
}
