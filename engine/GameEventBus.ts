import type { Direction } from "./types";

/**
 * Lightweight bus so DOM input and Phaser scenes stay decoupled.
 * Any future game can reuse this for UI ↔ core communication.
 */
export class GameEventBus extends EventTarget {
  emitDirection(direction: Direction): void {
    this.dispatchEvent(new CustomEvent("direction", { detail: direction }));
  }

  onDirection(handler: (direction: Direction) => void): () => void {
    const listener = (event: Event): void => {
      const { detail } = event as CustomEvent<Direction>;
      handler(detail);
    };
    this.addEventListener("direction", listener);
    return () => this.removeEventListener("direction", listener);
  }
}
