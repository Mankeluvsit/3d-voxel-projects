import type { HudStats } from "./types";

/** Tiny external store so React reads sim state without re-rendering per frame. */
export class HudStore {
  private listeners = new Set<() => void>();
  private snapshot: HudStats = {
    money: 0,
    population: 0,
    jobs: 0,
    day: 1,
    income: 0,
    demand: { r: 0, c: 0, i: 0 },
    speed: 1,
    tool: "select",
    overlay: "none",
    cars: 0,
    selected: null,
    ready: false,
    message: null,
  };

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;

  set(patch: Partial<HudStats>) {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const l of this.listeners) l();
  }
}
