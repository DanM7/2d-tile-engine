#!/usr/bin/env node
/** Segment BFS for level 11 StrategyWiki route (bold 211). */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { Direction, LevelData } from "../engine/types.js";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  msCc1RunnerStateKey,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { encodeSolutionMoves } from "../engine/solutionMoves.js";
import { readLevelSolution, writeLevelSolution } from "../integration/solutionStorage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const levelsDir = path.join(
  root,
  "../chips-challenge-web/apps/chips-challenge-web/public/games/chips-challenge-1/levels",
);
const webSolutionsDir = path.join(
  root,
  "../chips-challenge-web/apps/chips-challenge-web/public/games/chips-challenge-1/data/cc1-ms-solutions",
);
const dirs: Direction[] = ["up", "down", "left", "right"];
type Runner = ReturnType<typeof createMsCc1SimulationRunner>;

function loadLevel(): LevelData {
  const level = JSON.parse(
    fs.readFileSync(path.join(levelsDir, "level-011.json"), "utf8"),
  ) as LevelData;
  normalizeLevelLayers(level);
  return level;
}

function applyMoves(start: Runner, seq: Direction[]): Runner {
  const r = cloneMsCc1SimulationRunner(start);
  for (const m of seq) {
    if (stepMsCc1Simulation(r, m)) break;
  }
  return r;
}

function expand(notation: string): Direction[] {
  const map: Record<string, Direction> = { U: "up", D: "down", L: "left", R: "right" };
  const out: Direction[] = [];
  for (const tok of notation.split(/\s+/)) {
    const m = tok.match(/^(\d+)?([UDLR])$/);
    if (!m) throw new Error(tok);
    const n = m[1] ? Number.parseInt(m[1], 10) : 1;
    for (let i = 0; i < n; i += 1) out.push(map[m[2]!]!);
  }
  return out;
}

function segmentBfs(
  start: Runner,
  maxDepth: number,
  maxNodes: number,
  done: (r: Runner) => boolean,
): Direction[] | null {
  const q: { seq: Direction[]; runner: Runner }[] = [{ seq: [], runner: start }];
  const seen = new Set<string>([msCc1RunnerStateKey(start)]);
  let nodes = 0;
  while (q.length && nodes < maxNodes) {
    const f = q.shift()!;
    nodes += 1;
    if (done(f.runner)) return f.seq;
    if (f.runner.playerDied || f.seq.length >= maxDepth) continue;
    for (const d of dirs) {
      const next = cloneMsCc1SimulationRunner(f.runner);
      const before = msCc1RunnerStateKey(next);
      stepMsCc1Simulation(next, d);
      if (next.playerDied) continue;
      const after = msCc1RunnerStateKey(next);
      if (after === before || seen.has(after)) continue;
      seen.add(after);
      q.push({ seq: [...f.seq, d], runner: next });
    }
  }
  console.error("segment fail nodes", nodes);
  return null;
}

const level = loadLevel();
let runner = createMsCc1SimulationRunner(level);
const route: Direction[] = [];

function append(label: string, seq: Direction[] | null): void {
  if (!seq) {
    console.error("failed", label);
    process.exit(1);
  }
  route.push(...seq);
  runner = applyMoves(runner, seq);
  console.log(
    label,
    "+",
    seq.length,
    "->",
    runner.gx,
    runner.gy,
    "chips",
    runner.playerState.chipsRemainingOnMap,
    "keys",
    runner.playerState.keys.join("+") || "-",
    "tools",
    runner.playerState.tools.join("+") || "-",
  );
}

append("open", expand("D 3L D"));
append(
  "red-key",
  segmentBfs(runner, 80, 600_000, (r) => r.playerState.keys.includes("key_red")),
);
append(
  "yellow-key",
  segmentBfs(runner, 100, 800_000, (r) => r.playerState.keys.includes("key_yellow")),
);
append(
  "blue-key",
  segmentBfs(runner, 120, 1_000_000, (r) => r.playerState.keys.includes("key_blue")),
);
append(
  "ice-skates",
  segmentBfs(runner, 80, 600_000, (r) => r.playerState.tools.includes("tool_skates")),
);
append(
  "flippers",
  segmentBfs(runner, 80, 600_000, (r) => r.playerState.tools.includes("tool_flippers")),
);
append(
  "fire-boots",
  segmentBfs(runner, 80, 600_000, (r) => r.playerState.tools.includes("tool_fire")),
);
append(
  "all-chips",
  segmentBfs(runner, 120, 1_000_000, (r) => r.playerState.chipsRemainingOnMap === 0),
);
append("exit", segmentBfs(runner, 60, 400_000, (r) => r.completed));

const entry = readLevelSolution<{ timeLimitSeconds: number; boldTimeRemaining: number }>(11)!;
const verify = createMsCc1SimulationRunner(structuredClone(level));
for (const m of route) {
  if (stepMsCc1Simulation(verify, m)) break;
}
const rem = msSecondsRemaining(entry.timeLimitSeconds, verify.buttonPressCtx.moveBoundary);
console.log({
  moves: route.length,
  completed: verify.completed,
  rem,
  bold: entry.boldTimeRemaining,
  meets: rem >= entry.boldTimeRemaining,
});
if (!verify.completed) process.exit(1);

const updated = {
  ...readLevelSolution(11),
  moves: encodeSolutionMoves(route),
  moveVerified: true,
  meetsBoldBudget: rem >= entry.boldTimeRemaining,
  moveSource: "Segment BFS from StrategyWiki Trinity outline",
  walkthroughUrl: "https://strategywiki.org/wiki/Chip%27s_Challenge/Levels_1-20",
  boldGapNote:
    rem >= entry.boldTimeRemaining
      ? undefined
      : `Verified complete; ${rem} remaining vs bold ${entry.boldTimeRemaining}`,
};
writeLevelSolution(11, updated);
const { twsRecords, twsRecordSource, ...webEntry } = updated as Record<string, unknown> & {
  twsRecords?: unknown;
  twsRecordSource?: unknown;
};
fs.mkdirSync(webSolutionsDir, { recursive: true });
fs.writeFileSync(path.join(webSolutionsDir, "level-011.json"), `${JSON.stringify(webEntry, null, 2)}\n`);
