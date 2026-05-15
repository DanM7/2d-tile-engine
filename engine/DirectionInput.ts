import type { Direction } from "./types";
import type { GameEventBus } from "./GameEventBus";

const DIR_ATTR = "data-dir";

function isDirection(value: string): value is Direction {
  return value === "up" || value === "down" || value === "left" || value === "right";
}

/**
 * Maps on-screen D-pad buttons and keyboard arrows / WASD to direction events.
 */
export class DirectionInput {
  private readonly bus: GameEventBus;
  private keyListener: ((event: KeyboardEvent) => void) | null = null;

  constructor(bus: GameEventBus) {
    this.bus = bus;
  }

  /** Wire the HTML control panel (expects elements with `data-dir`). */
  bindDpad(container: HTMLElement): void {
    container.addEventListener("click", (event) => {
      const target = (event.target as HTMLElement).closest(`[${DIR_ATTR}]`);
      if (!target) return;
      const raw = target.getAttribute(DIR_ATTR);
      if (!raw || !isDirection(raw)) return;
      this.bus.emitDirection(raw);
    });
  }

  /** Desktop / hardware keyboard: Arrow keys and WASD. */
  bindKeyboard(): void {
    if (this.keyListener) return;

    this.keyListener = (event: KeyboardEvent) => {
      if (event.repeat) return;

      const keyMap: Record<string, Direction> = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
        w: "up",
        W: "up",
        s: "down",
        S: "down",
        a: "left",
        A: "left",
        d: "right",
        D: "right",
      };

      const direction = keyMap[event.key];
      if (!direction) return;

      event.preventDefault();
      this.bus.emitDirection(direction);
    };

    window.addEventListener("keydown", this.keyListener);
  }

  dispose(): void {
    if (this.keyListener) {
      window.removeEventListener("keydown", this.keyListener);
      this.keyListener = null;
    }
  }
}
