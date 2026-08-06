# 3D · Voxel · Projects

A hub repo collecting every 3D, voxel, and isometric build from [Mankeluvsit](https://github.com/Mankeluvsit).
Each project is a snapshot copy (no nested git history) living in its own folder, and
`index.html` links to each one's live preview.

## Projects

| Folder | What it is | Preview port |
|---|---|---|
| `sky-sim-forge/` | Island Architect — isometric 3D world builder (traffic, population, skybox, terrain) | 5173 |
| `3d-iso/` | Isometric 3D experiment (AI Studio) | 5174 |
| `Voxel-world/` | Voxel world experiment (AI Studio) | 5175 |
| `skyabc/` | Sky / skybox 3D experiment | 5176 |
| `babyloniso/` | Babylon.js isometric experiment | 5177 |
| `sky1/` | Empty stub — placeholder for a future sky project | — |

## Run everything locally

```bash
# each project: install + dev server on its port
cd sky-sim-forge && npm install && npm run dev -- --port 5173 --strictPort
cd 3d-iso      && npm install && npx vite --port 5174 --strictPort
cd Voxel-world && npm install && npx vite --port 5175 --strictPort
cd skyabc      && npm install && npx vite --port 5176 --strictPort
cd babyloniso  && npm install && npx vite --port 5177 --strictPort

# the index page
python3 -m http.server 8000 --bind 127.0.0.1   # then open http://localhost:8000/
```

Ports were chosen after checking what was already listening (3000, 3030, 8080, 9090 are
used by other processes; 5173–5177 and 8000 were free).

## Notes

- The three AI Studio projects (`3d-iso`, `Voxel-world`, `skyabc`) run their Vite frontend
  directly for preview; their `server.ts` backends (AI Studio API layer) are not started.
- Originals remain on GitHub under the same names — this repo is the curated collection.
