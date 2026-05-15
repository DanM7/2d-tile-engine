import Phaser from "phaser";
import type { RunState } from "./types.js";
import { KEY_TILE_IDS } from "../dat/tiles.js";

export type KeyTileId = "key_blue" | "key_red" | "key_green" | "key_yellow";

export interface RunSessionConfig {
  levelNumber: number;
  /** Countdown start; `null` = no play clock (HUD shows dashes). */
  playClockInitialSeconds: number | null;
  collectiblesInitialCount: number;
}

/**
 * Generic per-level run counters (ruleset-agnostic).
 * Drives HUD via `run-state` events on the Phaser game bus.
 */
export class RunSession {
  private readonly config: RunSessionConfig;
  private readonly emit: (state: RunState) => void;
  private playClockSeconds: number | null;
  private collectiblesLeftCount: number;
  private readonly keysHeld: KeyTileId[] = [];
  private clockTimer: Phaser.Time.TimerEvent | null = null;

  constructor(config: RunSessionConfig, emit: (state: RunState) => void) {
    this.config = config;
    this.emit = emit;
    this.playClockSeconds = config.playClockInitialSeconds;
    this.collectiblesLeftCount = config.collectiblesInitialCount;
  }

  getState(): RunState {
    return {
      levelNumber: this.config.levelNumber,
      playClockSeconds: this.playClockSeconds,
      collectiblesLeftCount: this.collectiblesLeftCount,
      inventory: { keys: [...this.keysHeld] },
    };
  }

  hasKey(keyId: string): boolean {
    return this.keysHeld.includes(keyId as KeyTileId);
  }

  /** Pick up a key if that color is not already held. */
  tryAddKey(keyId: string): boolean {
    if (!KEY_TILE_IDS.has(keyId)) {
      return false;
    }
    const id = keyId as KeyTileId;
    if (this.keysHeld.includes(id)) {
      return false;
    }
    this.keysHeld.push(id);
    this.emitState();
    return true;
  }

  /** Spend a held key (e.g. opening a matching door). */
  consumeKey(keyId: string): boolean {
    const id = keyId as KeyTileId;
    const index = this.keysHeld.indexOf(id);
    if (index < 0) {
      return false;
    }
    this.keysHeld.splice(index, 1);
    this.emitState();
    return true;
  }

  /** Bind countdown tick to the scene clock; call once after level load. */
  start(scene: Phaser.Scene): void {
    this.stop();
    this.emitState();

    if (this.playClockSeconds == null || this.playClockSeconds <= 0) {
      return;
    }

    this.clockTimer = scene.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (this.playClockSeconds == null || this.playClockSeconds <= 0) {
          this.stopClock();
          return;
        }
        this.playClockSeconds -= 1;
        this.emitState();
        if (this.playClockSeconds <= 0) {
          this.stopClock();
        }
      },
    });
  }

  /** Player picked up one collectible still on the map. */
  collectOne(): boolean {
    if (this.collectiblesLeftCount <= 0) {
      return false;
    }
    this.collectiblesLeftCount -= 1;
    this.emitState();
    return true;
  }

  stop(): void {
    this.stopClock();
  }

  private stopClock(): void {
    if (this.clockTimer) {
      this.clockTimer.destroy();
      this.clockTimer = null;
    }
  }

  private emitState(): void {
    this.emit(this.getState());
  }
}
