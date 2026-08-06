import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { TOOLS, type ToolId } from "@/game/config";
import { Game } from "@/game/game";
import { AUTOSAVE_NAME, listSaves, deleteSave, type SaveSlot } from "@/game/save";
import { HudStore } from "@/game/store";
import type { Overlay } from "@/game/types";

const store = new HudStore();
const emptySnapshot = store.getSnapshot();

function fmt(n: number) {
  return n.toLocaleString("en-US");
}

function DemandBar({ label, value, tone }: { label: string; value: number; tone: string }) {
  const pct = Math.round(((value + 1) / 2) * 100);
  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <div className="pixel-inset h-3 w-14">
        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function GameView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const [saves, setSaves] = useState<SaveSlot[]>([]);
  const [showSaves, setShowSaves] = useState(false);
  const [saveName, setSaveName] = useState("My City");

  const stats = useSyncExternalStore(store.subscribe, store.getSnapshot, () => emptySnapshot);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const probe = document.createElement("canvas");
    const supported = !!(probe.getContext("webgl2") || probe.getContext("webgl"));
    if (!supported) {
      setError("This browser or device can't run WebGL, so the 3D city can't be displayed.");
      return;
    }
    let game: Game;
    try {
      game = new Game(canvas, store);
    } catch (err) {
      console.error(err);
      setError("The 3D renderer failed to start on this device.");
      return;
    }
    gameRef.current = game;
    const onResize = () => game.resize();
    window.addEventListener("resize", onResize);
    setSaves(listSaves());
    if (typeof window !== "undefined" && !window.localStorage.getItem("voxelcity.seenHelp")) {
      setHelp(true);
      window.localStorage.setItem("voxelcity.seenHelp", "1");
    }
    return () => {
      window.removeEventListener("resize", onResize);
      game.destroy();
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!stats.message) return;
    toast(stats.message.split("|")[0]);
  }, [stats.message]);

  const setTool = useCallback((id: ToolId) => gameRef.current?.setTool(id), []);
  const setOverlay = useCallback((o: Overlay) => gameRef.current?.setOverlay(o), []);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="pixel-panel max-w-md p-6 text-center">
          <h1 className="text-display text-sm text-primary">Voxel City</h1>
          <p className="mt-4 text-lg text-muted-foreground">{error}</p>
        </div>
      </main>
    );
  }

  const sel = stats.selected;

  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <h1 className="sr-only">Voxel City — isometric 3D city builder</h1>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" />

      {!stats.ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-panel-deep">
          <p className="text-display animate-pulse text-xs text-primary">GENERATING TERRAIN…</p>
        </div>
      )}

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-center gap-2 p-2">
        <div className="pixel-panel pointer-events-auto flex flex-wrap items-center gap-3 px-3 py-2">
          <span className="text-display text-[10px] text-primary">VOXEL CITY</span>
          <span className="text-money text-xl leading-none">${fmt(stats.money)}</span>
          <span className="text-people text-xl leading-none">{fmt(stats.population)} pop</span>
          <span className="text-work text-xl leading-none">{fmt(stats.jobs)} jobs</span>
          <span className="text-lg text-muted-foreground">Day {stats.day}</span>
          <span className="text-lg text-muted-foreground">
            {stats.income >= 0 ? "+" : ""}
            {fmt(stats.income)}/day
          </span>
        </div>

        <div className="pixel-panel pointer-events-auto flex items-center gap-1 px-2 py-2">
          {[0, 1, 2, 4].map((s) => (
            <button
              key={s}
              onClick={() => gameRef.current?.setSpeed(s)}
              className={`text-display px-2 py-1 text-[10px] ${
                stats.speed === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s === 0 ? "II" : `${s}x`}
            </button>
          ))}
        </div>

        <div className="pixel-panel pointer-events-auto flex flex-col gap-1 px-2 py-1">
          <DemandBar label="R" value={stats.demand.r} tone="bg-zone-res" />
          <DemandBar label="C" value={stats.demand.c} tone="bg-zone-com" />
          <DemandBar label="I" value={stats.demand.i} tone="bg-zone-ind" />
        </div>

        <div className="pixel-panel pointer-events-auto flex items-center gap-1 px-2 py-2">
          {(["none", "traffic", "zones"] as Overlay[]).map((o) => (
            <button
              key={o}
              onClick={() => setOverlay(o)}
              className={`text-display px-2 py-1 text-[9px] uppercase ${
                stats.overlay === o ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {o}
            </button>
          ))}
        </div>

        <div className="pixel-panel pointer-events-auto flex items-center gap-1 px-2 py-2">
          <button className="text-display px-2 py-1 text-[9px]" onClick={() => setHelp(true)}>
            HELP
          </button>
          <button
            className="text-display px-2 py-1 text-[9px]"
            onClick={() => {
              setSaves(listSaves());
              setShowSaves((v) => !v);
            }}
          >
            CITY
          </button>
        </div>
      </div>

      {/* Inspector */}
      {sel && (
        <aside className="pixel-panel absolute right-2 top-24 w-52 p-3 text-lg">
          <h2 className="text-display mb-2 text-[10px] text-primary">
            TILE {sel.x},{sel.z}
          </h2>
          <dl className="space-y-1 text-muted-foreground">
            <Row k="Terrain" v={sel.terrain} />
            <Row k="Zone" v={sel.zone} />
            <Row k="Level" v={`${sel.level}/5`} />
            <Row k="Height" v={String(sel.height)} />
            {sel.pop > 0 && <Row k="Residents" v={fmt(sel.pop)} />}
            {sel.jobs > 0 && <Row k="Jobs" v={fmt(sel.jobs)} />}
            {sel.zone === "road" && <Row k="Traffic" v={`${Math.round(sel.traffic * 100)}%`} />}
            <Row k="Road access" v={sel.hasRoad ? "yes" : "no"} />
          </dl>
        </aside>
      )}

      {/* Tool dock */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-2">
        <div className="pixel-panel pointer-events-auto flex max-w-full flex-wrap justify-center gap-1 p-2">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              title={`${t.label} — ${t.hint}`}
              className={`flex w-16 flex-col items-center gap-0.5 px-1 py-2 ${
                stats.tool === t.id
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-secondary"
              }`}
            >
              <span className="text-display text-[9px]">{t.short}</span>
              <span className="text-sm leading-none opacity-80">{t.cost ? `$${t.cost}` : "—"}</span>
            </button>
          ))}
        </div>
      </div>

      {/* City menu */}
      {showSaves && (
        <div className="pixel-panel absolute left-2 top-24 z-20 w-72 p-3">
          <h2 className="text-display mb-2 text-[10px] text-primary">CITY</h2>
          <div className="flex gap-1">
            <input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              className="pixel-inset w-full px-2 py-1 text-lg text-foreground outline-none"
              aria-label="Save name"
            />
            <button
              className="text-display bg-primary px-2 text-[9px] text-primary-foreground"
              onClick={() => {
                gameRef.current?.save(saveName || "City");
                setSaves(listSaves());
              }}
            >
              SAVE
            </button>
          </div>
          <button
            className="text-display mt-2 w-full bg-secondary px-2 py-2 text-[9px]"
            onClick={() => {
              gameRef.current?.newCity();
              setShowSaves(false);
            }}
          >
            NEW CITY
          </button>
          <ul className="mt-3 space-y-1">
            {saves.map((s) => (
              <li key={s.name} className="flex items-center justify-between gap-2 text-lg">
                <button
                  className="flex-1 text-left hover:text-primary"
                  onClick={() => {
                    gameRef.current?.load(s);
                    setShowSaves(false);
                  }}
                >
                  {s.name === AUTOSAVE_NAME ? "Autosave" : s.name}
                  <span className="ml-2 text-sm text-muted-foreground">
                    day {s.day} · {fmt(s.population)} pop
                  </span>
                </button>
                <button
                  className="text-destructive"
                  aria-label={`Delete ${s.name}`}
                  onClick={() => {
                    deleteSave(s.name);
                    setSaves(listSaves());
                  }}
                >
                  x
                </button>
              </li>
            ))}
            {!saves.length && <li className="text-lg text-muted-foreground">No saved cities yet.</li>}
          </ul>
        </div>
      )}

      {/* Help */}
      {help && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-panel-deep/80 p-4">
          <div className="pixel-panel max-h-full w-full max-w-lg overflow-auto p-5">
            <h2 className="text-display text-xs text-primary">HOW TO PLAY</h2>
            <ul className="mt-4 space-y-2 text-xl text-muted-foreground">
              <li>1. Lay roads with the RD tool — drag to paint.</li>
              <li>2. Zone housing (RES), shops (COM) and industry (IND) next to roads.</li>
              <li>3. Watch the R/C/I demand bars: build what the city is hungry for.</li>
              <li>4. Traffic slows growth — use the TRAFFIC overlay and add alternate routes.</li>
              <li>5. Taxes arrive each day. Parks raise nearby desirability.</li>
            </ul>
            <h3 className="text-display mt-5 text-[10px] text-accent">CONTROLS</h3>
            <ul className="mt-3 space-y-1 text-xl text-muted-foreground">
              <li>Drag (Inspect tool) or right-drag: pan · Wheel / pinch: zoom</li>
              <li>Q / E: rotate the world · Space: pause</li>
              <li>Keys 1-9: pick a tool · Touch: one finger pans, two fingers zoom</li>
            </ul>
            <button
              className="text-display mt-6 w-full bg-primary px-3 py-3 text-[10px] text-primary-foreground"
              onClick={() => setHelp(false)}
            >
              BUILD MY CITY
            </button>
          </div>
        </div>
      )}

      <Toaster position="bottom-left" />
    </main>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt>{k}</dt>
      <dd className="text-foreground">{v}</dd>
    </div>
  );
}
