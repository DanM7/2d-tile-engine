import { describe, expect, it } from "vitest";
import { decodeSolutionMoves, encodeSolutionMoves } from "../engine/solutionMoves.js";

describe("solutionMoves", () => {
  it("round-trips directions as U/D/L/R letters", () => {
    const moves = ["up", "down", "left", "right"] as const;
    expect(encodeSolutionMoves([...moves])).toEqual(["U", "D", "L", "R"]);
    expect(decodeSolutionMoves(["U", "D", "L", "R"])).toEqual([...moves]);
  });

  it("still decodes legacy spelled-out moves", () => {
    expect(decodeSolutionMoves(["up", "left"])).toEqual(["up", "left"]);
  });
});
