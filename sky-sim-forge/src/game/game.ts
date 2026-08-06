import { TICK_HZ, TOOL_BY_ID, type ToolId } from "./config";
import { AUTOSAVE_NAME, deserialize, writeSave, type SaveSlot } from "./save";
import { createState, step, tripEndpoints } from "./sim";
import { GameScene } from "./render/scene";
import { mulberry32 } from "./rng";
import { HudStore } from "./store";
import { TrafficSystem } from "./traffic";
import type { GameState, Overlay, SelectedInfo } from "./types";
import { hasRoadAccess, idx, isBuildable, terrainFor } from "./world";

const SPEEDS = [0, 1, 2, 4];

export class Game {
  state: GameState;
  scene: GameScene;
  traffic = new TrafficSystem();
  private store: HudStore;
  private canvas: HTMLCanvasElement;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private hudAcc = 0;
  private overlayAcc = 0;
  private autosaveAcc = 0;
  private speed = 1;
  private tool: ToolId = "road";
  private overlay: Overlay = "none";
  private selected: SelectedInfo | null = null;
  private rng = mulberry32(0xc0ffee);
  private dirty = false;
  private disposed = false;

  // pointer state
  private dragging: "none" | "pan" | "paint" = "none";
  private lastPointer = { x: 0, y: 0 };
  private painted = new Set<number>();
  private pinchDist = 0;
  private movedPx = 0;

  constructor(canvas: HTMLCanvasElement, store: HudStore, seed = Math.floor(Math.random() * 1e9)) {
    this.canvas = canvas;
    this.store = store;
    this.state = createState(seed);
    this.scene = new GameScene(canvas, this.state.world);
    this.scene.setDayTime(this.state.dayTime);
    this.attach();
    this.resize();
    this.pushHud({ ready: true });
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  // ---------- public API ----------

  setTool(tool: ToolId) {
    this.tool = tool;
    this.pushHud({ tool });
  }

  setSpeed(speed: number) {
    this.speed = speed;
    this.pushHud({ speed });
  }

  cycleSpeed() {
    const i = SPEEDS.indexOf(this.speed);
    this.setSpeed(SPEEDS[(i + 1) % SPEEDS.length]);
  }

  setOverlay(overlay: Overlay) {
    this.overlay = overlay;
    this.scene.setOverlay(this.state.world, overlay);
    this.pushHud({ overlay });
  }

  rotate(dir: number) {
    this.scene.rotate(dir);
  }

  newCity(seed = Math.floor(Math.random() * 1e9)) {
    this.state = createState(seed);
    this.traffic.reset();
    this.selected = null;
    this.scene.rebuild(this.state.world);
    this.scene.setOverlay(this.state.world, this.overlay);
    this.pushHud({ selected: null });
    this.notify("New city generated");
  }

  save(name: string) {
    writeSave(name, this.state);
    this.notify(`Saved "${name}"`);
  }

  load(slot: SaveSlot) {
    deserialize(slot.data, this.state);
    this.traffic.reset();
    this.selected = null;
    this.scene.rebuild(this.state.world);
    this.scene.setOverlay(this.state.world, this.overlay);
    this.pushHud({ selected: null });
    this.notify(`Loaded "${slot.name}"`);
  }

  resize() {
    const w = this.canvas.clientWidth || this.canvas.parentElement?.clientWidth || 800;
    const h = this.canvas.clientHeight || this.canvas.parentElement?.clientHeight || 600;
    this.scene.resize(w, h);
  }

  destroy() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.detach();
    this.scene.dispose();
  }

  // ---------- loop ----------

  private frame = (now: number) => {
    if (this.disposed) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;

    if (this.speed > 0) {
      this.acc += dt * this.speed;
      const stepTime = 1 / TICK_HZ;
      let steps = 0;
      while (this.acc >= stepTime && steps < 6) {
        this.acc -= stepTime;
        steps++;
        if (step(this.state)) this.dirty = true;
      }
      const { sources, sinks } = tripEndpoints(this.state.world);
      this.traffic.update(this.state.world, dt * Math.min(2, this.speed), sources, sinks, this.rng);
      this.scene.setDayTime(this.state.dayTime);
    }

    if (this.dirty) {
      this.dirty = false;
      this.scene.rebuild(this.state.world);
    }

    this.scene.updateCars(this.state.world, this.traffic.cars);
    this.scene.updateCamera(dt);
    this.scene.render();

    this.overlayAcc += dt;
    if (this.overlay === "traffic" && this.overlayAcc > 0.35) {
      this.overlayAcc = 0;
      this.scene.refreshOverlay(this.state.world);
    }

    this.hudAcc += dt;
    if (this.hudAcc > 0.25) {
      this.hudAcc = 0;
      this.pushHud({});
    }

    this.autosaveAcc += dt;
    if (this.autosaveAcc > 30) {
      this.autosaveAcc = 0;
      writeSave(AUTOSAVE_NAME, this.state);
    }

    this.raf = requestAnimationFrame(this.frame);
  };

  private pushHud(patch: Record<string, unknown>) {
    this.store.set({
      money: Math.round(this.state.money),
      population: Math.round(this.state.population),
      jobs: Math.round(this.state.jobs),
      day: this.state.day,
      income: this.state.lastIncome,
      demand: { ...this.state.demand },
      speed: this.speed,
      tool: this.tool,
      overlay: this.overlay,
      cars: this.traffic.cars.length,
      selected: this.selected,
      ...patch,
    });
  }

  private notify(message: string) {
    // Nonce keeps repeated messages distinct so the UI can re-announce them.
    this.pushHud({ message: `${message}|${Date.now()}` });
  }

  // ---------- editing ----------

  private inspect(x: number, z: number) {
    const world = this.state.world;
    const tile = world.tiles[idx(x, z, world.size)];
    this.selected = {
      x,
      z,
      terrain: tile.terrain,
      zone: tile.zone,
      level: tile.level,
      pop: Math.round(tile.pop),
      jobs: Math.round(tile.jobs),
      height: tile.h,
      traffic: tile.traffic,
      hasRoad: hasRoadAccess(world, x, z),
    };
    this.pushHud({ selected: this.selected });
  }

  canApply(x: number, z: number): boolean {
    const world = this.state.world;
    const tile = world.tiles[idx(x, z, world.size)];
    switch (this.tool) {
      case "select":
        return true;
      case "bulldoze":
        return tile.zone !== "none" || tile.tree;
      case "raise":
        return tile.h < 14;
      case "lower":
        return tile.h > 0;
      case "road":
        return tile.terrain !== "water" && tile.zone !== "road";
      default:
        return tile.terrain !== "water" && tile.zone === "none" && isBuildable(world, x, z);
    }
  }

  private applyTool(x: number, z: number) {
    const world = this.state.world;
    const i = idx(x, z, world.size);
    const tile = world.tiles[i];
    const tool = this.tool;

    if (tool === "select") {
      this.inspect(x, z);
      return;
    }
    if (!this.canApply(x, z)) return;

    const def = TOOL_BY_ID[tool];
    if (this.state.money < def.cost) {
      this.notify("Not enough money");
      return;
    }

    switch (tool) {
      case "bulldoze":
        tile.zone = "none";
        tile.level = 0;
        tile.pop = 0;
        tile.jobs = 0;
        tile.tree = false;
        tile.traffic = 0;
        this.traffic.validate(world);
        break;
      case "raise":
      case "lower": {
        tile.h += tool === "raise" ? 1 : -1;
        tile.terrain = terrainFor(tile.h);
        if (tile.terrain === "water") {
          tile.zone = "none";
          tile.level = 0;
          tile.tree = false;
          this.traffic.validate(world);
        }
        break;
      }
      case "road":
        tile.zone = "road";
        tile.level = 0;
        tile.tree = false;
        break;
      default:
        tile.zone = tool;
        tile.level = 1;
        tile.tree = false;
        tile.grow = 0;
        break;
    }

    this.state.money -= def.cost;
    this.dirty = true;
    if (this.selected && this.selected.x === x && this.selected.z === z) this.inspect(x, z);
  }

  // ---------- input ----------

  private attach() {
    const c = this.canvas;
    c.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    c.addEventListener("wheel", this.onWheel, { passive: false });
    c.addEventListener("contextmenu", this.onContextMenu);
    c.addEventListener("touchstart", this.onTouch, { passive: false });
    c.addEventListener("touchmove", this.onTouch, { passive: false });
    c.addEventListener("touchend", this.onTouchEnd);
    window.addEventListener("keydown", this.onKeyDown);
  }

  private detach() {
    const c = this.canvas;
    c.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    c.removeEventListener("wheel", this.onWheel);
    c.removeEventListener("contextmenu", this.onContextMenu);
    c.removeEventListener("touchstart", this.onTouch);
    c.removeEventListener("touchmove", this.onTouch);
    c.removeEventListener("touchend", this.onTouchEnd);
    window.removeEventListener("keydown", this.onKeyDown);
  }

  private onContextMenu = (e: Event) => e.preventDefault();

  private onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === "touch") return; // handled by touch events
    this.movedPx = 0;
    this.lastPointer = { x: e.clientX, y: e.clientY };
    const build = this.tool !== "select";
    if (e.button === 0 && build) {
      this.dragging = "paint";
      this.painted.clear();
      this.paintAt(e.clientX, e.clientY);
    } else {
      this.dragging = "pan";
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    if (e.pointerType === "touch") return;
    const dx = e.clientX - this.lastPointer.x;
    const dy = e.clientY - this.lastPointer.y;
    this.lastPointer = { x: e.clientX, y: e.clientY };
    this.movedPx += Math.abs(dx) + Math.abs(dy);

    if (this.dragging === "pan") {
      this.scene.pan(dx, dy);
      return;
    }
    if (this.dragging === "paint") {
      this.paintAt(e.clientX, e.clientY);
      return;
    }
    this.hoverAt(e.clientX, e.clientY);
  };

  private onPointerUp = (e: PointerEvent) => {
    if (this.dragging === "pan" && this.movedPx < 5 && this.tool === "select") {
      const hit = this.scene.pick(e.clientX, e.clientY, this.state.world);
      if (hit) this.inspect(hit.x, hit.z);
    }
    this.dragging = "none";
    this.painted.clear();
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.scene.zoomBy(e.deltaY > 0 ? 1.12 : 0.89);
  };

  private onTouch = (e: TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      const t = e.touches[0];
      if (e.type === "touchstart") {
        this.lastPointer = { x: t.clientX, y: t.clientY };
        this.movedPx = 0;
        this.dragging = this.tool === "select" ? "pan" : "paint";
        if (this.dragging === "paint") {
          this.painted.clear();
          this.paintAt(t.clientX, t.clientY);
        }
        return;
      }
      const dx = t.clientX - this.lastPointer.x;
      const dy = t.clientY - this.lastPointer.y;
      this.lastPointer = { x: t.clientX, y: t.clientY };
      this.movedPx += Math.abs(dx) + Math.abs(dy);
      if (this.dragging === "pan") this.scene.pan(dx, dy);
      else this.paintAt(t.clientX, t.clientY);
      return;
    }
    if (e.touches.length >= 2) {
      const [a, b] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const midX = (a.clientX + b.clientX) / 2;
      const midY = (a.clientY + b.clientY) / 2;
      if (e.type === "touchstart" || this.pinchDist === 0) {
        this.pinchDist = dist;
        this.lastPointer = { x: midX, y: midY };
        this.dragging = "none";
        return;
      }
      this.scene.zoomBy(this.pinchDist / Math.max(1, dist));
      this.pinchDist = dist;
      this.scene.pan(midX - this.lastPointer.x, midY - this.lastPointer.y);
      this.lastPointer = { x: midX, y: midY };
    }
  };

  private onTouchEnd = (e: TouchEvent) => {
    if (e.touches.length === 0) {
      if (this.dragging === "pan" && this.movedPx < 8 && this.tool === "select") {
        const t = e.changedTouches[0];
        const hit = t && this.scene.pick(t.clientX, t.clientY, this.state.world);
        if (hit) this.inspect(hit.x, hit.z);
      }
      this.dragging = "none";
      this.pinchDist = 0;
      this.painted.clear();
    }
  };

  private onKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
    const key = e.key.toLowerCase();
    if (key === "q") this.rotate(-1);
    else if (key === "e") this.rotate(1);
    else if (key === " ") {
      e.preventDefault();
      this.setSpeed(this.speed === 0 ? 1 : 0);
    } else if (key === "+" || key === "=") this.scene.zoomBy(0.85);
    else if (key === "-") this.scene.zoomBy(1.18);
    else {
      const tool = Object.values(TOOL_BY_ID).find((t) => t.key === key);
      if (tool) this.setTool(tool.id);
    }
  };

  private hoverAt(clientX: number, clientY: number) {
    const hit = this.scene.pick(clientX, clientY, this.state.world);
    if (!hit) {
      this.scene.setHover(this.state.world, null, null, false);
      return;
    }
    this.scene.setHover(this.state.world, hit.x, hit.z, this.canApply(hit.x, hit.z));
  }

  private paintAt(clientX: number, clientY: number) {
    const hit = this.scene.pick(clientX, clientY, this.state.world);
    if (!hit) return;
    const key = hit.z * this.state.world.size + hit.x;
    this.scene.setHover(this.state.world, hit.x, hit.z, this.canApply(hit.x, hit.z));
    if (this.painted.has(key)) return;
    this.painted.add(key);
    this.applyTool(hit.x, hit.z);
  }
}
