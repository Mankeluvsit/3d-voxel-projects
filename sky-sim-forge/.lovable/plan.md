## Voxel City Builder — build plan

A retro voxel, isometric 3D city builder rendered with Three.js on an orthographic camera, running entirely client-side with local saves.

### What you'll get

**The world**
- 64×64 tile grid, procedurally generated on new game: layered value-noise heightmap, water below sea level, sand shoreline, grass, rock at altitude, scattered trees.
- Terrain is drawn as a single merged voxel-block mesh (vertex-colored, flat-shaded, chunked) so tens of thousands of blocks stay fast.
- Gradient sky dome + sun/moon directional light, soft shadows, and a day/night cycle that tints the world and lights up windows at night.

**Building**
- Tool palette: bulldoze, raise/lower terrain, road, residential, commercial, industrial, park, plus a few civic props.
- Hover highlight on the tile under the cursor, drag-to-paint roads and zones, ghost preview with valid/invalid coloring (can't build on water or steep slope, zones need road adjacency).
- Buildings are chunky voxel props that grow from small to tall as the tile's population/demand rises.

**Simulation (fixed-step tick loop)**
- Roads form a graph; cars spawn at populated tiles, pathfind (A*) to a destination along the road network, and animate along the path with turning, queueing at intersections, and despawn on arrival.
- Traffic density per road segment feeds back into the sim and is visible as a toggleable congestion overlay.
- Population grows on residential tiles served by road access and nearby jobs; simple money/tax loop funds construction, plus speed controls (pause / 1x / 2x / 3x).

**Camera & controls**
- Orthographic iso camera, drag-pan, scroll-zoom, Q/E 90° rotation snapping, keyboard shortcuts for tools.
- Touch support: one-finger pan, pinch zoom, tap to place.

**UI**
- Pixel-styled HUD: top bar with cash, population, date and speed controls; bottom tool dock with icons and costs; right-side inspector panel showing the selected tile's stats; overlay toggles (traffic, zones, terrain).
- First-run help/tutorial modal listing controls and goals, reopenable from the HUD.
- Toasts for build errors, insufficient funds, milestones.

**Persistence**
- Autosave to localStorage every ~30s plus manual save/load/new-city with named slots; versioned save format so future changes don't break old cities.

### Design direction
Retro pixel/voxel: bright saturated palette, hard edges, no bevels, chunky 1×1 blocks, dithered-looking sky gradient. UI uses a pixel display font with crisp square-cornered panels — all colors added as semantic tokens in `src/styles.css`, no hardcoded color classes.

### Technical notes
- Add `three` (+ `@types/three`). No React Three Fiber — a plain Three.js renderer class driven by an imperative game module keeps the tick loop and instanced meshes fast.
- The whole game is client-only: the canvas component is loaded via `React.lazy` behind a `ClientOnly` gate so SSR never evaluates Three.js, with a loading screen while the scene warms up.
- Structure: `src/game/` holds framework-free logic (`world.ts` terrain gen, `sim.ts` tick loop, `traffic.ts` graph + A*, `save.ts`), `src/game/render/` holds the Three.js scene, mesh builders and camera controller, `src/components/hud/` holds React UI. React reads sim state through a subscription store — the render loop never triggers React re-renders per frame.
- Single route at `/` with its own SEO head metadata; the placeholder index is replaced.
- Verified with a headless browser pass: the sandbox has no GPU, so I'll confirm boot, HUD, and sim state render without WebGL errors and include a graceful "WebGPU/WebGL unavailable" fallback message; visual confirmation happens in your browser.

### Build order
1. Deps, design tokens, route, ClientOnly canvas shell.
2. Terrain generation + voxel mesh + iso camera controls + skybox/day-night.
3. Tile selection, tool system, building placement and voxel building meshes.
4. Road graph, traffic A* and car animation, congestion overlay.
5. Population/economy tick, demand, growth.
6. HUD, inspector, overlays, help modal, toasts.
7. Save/load slots + autosave, then perf pass and polish.
