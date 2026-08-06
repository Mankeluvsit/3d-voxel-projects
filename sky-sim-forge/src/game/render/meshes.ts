import * as THREE from "three";
import { BLOCK_H, SEA_LEVEL } from "../config";
import { hash2 } from "../rng";
import type { World, Zone } from "../types";
import { idx } from "../world";
import { ROAD_COLOR, ROAD_LINE, TERRAIN_SIDE, TERRAIN_TOP, ZONE_COLOR, shade } from "./palette";

const tmpColor = new THREE.Color();

/** Accumulates flat-shaded, vertex-coloured geometry. */
export class GeoBuilder {
  pos: number[] = [];
  norm: number[] = [];
  col: number[] = [];

  quad(
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number],
    d: [number, number, number],
    n: [number, number, number],
    color: THREE.Color,
  ) {
    const verts = [a, b, c, a, c, d];
    for (const v of verts) {
      this.pos.push(v[0], v[1], v[2]);
      this.norm.push(n[0], n[1], n[2]);
      this.col.push(color.r, color.g, color.b);
    }
  }

  /** Axis-aligned box from min corner + size. */
  box(x: number, y: number, z: number, w: number, h: number, d: number, hex: number, tint = 0) {
    const c = shade(hex, tint);
    const top = shade(hex, tint + 0.12);
    const side = shade(hex, tint - 0.12);
    const dark = shade(hex, tint - 0.26);
    const x1 = x + w;
    const y1 = y + h;
    const z1 = z + d;
    this.quad([x, y1, z1], [x1, y1, z1], [x1, y1, z], [x, y1, z], [0, 1, 0], top);
    this.quad([x, y, z], [x1, y, z], [x1, y, z1], [x, y, z1], [0, -1, 0], dark);
    this.quad([x, y, z1], [x1, y, z1], [x1, y1, z1], [x, y1, z1], [0, 0, 1], c);
    this.quad([x1, y, z], [x, y, z], [x, y1, z], [x1, y1, z], [0, 0, -1], dark);
    this.quad([x1, y, z1], [x1, y, z], [x1, y1, z], [x1, y1, z1], [1, 0, 0], side);
    this.quad([x, y, z], [x, y, z1], [x, y1, z1], [x, y1, z], [-1, 0, 0], side);
  }

  get count() {
    return this.pos.length / 3;
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.norm, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    return g;
  }
}

export function tileTopY(h: number) {
  return h * BLOCK_H;
}

export function seaY() {
  return (SEA_LEVEL + 0.55) * BLOCK_H;
}

export function buildTerrainGeometry(world: World) {
  const b = new GeoBuilder();
  const size = world.size;
  const off = -size / 2;

  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const tile = world.tiles[idx(x, z, size)];
      const jitter = (hash2(x, z, world.seed) - 0.5) * 0.1;
      const topHex = TERRAIN_TOP[tile.terrain];
      const sideHex = TERRAIN_SIDE[tile.terrain];
      const y = tileTopY(tile.h);
      const x0 = off + x;
      const z0 = off + z;
      const x1 = x0 + 1;
      const z1 = z0 + 1;

      const top = shade(topHex, jitter);
      b.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [0, 1, 0], top);

      const sides: Array<[number, number, [number, number, number]]> = [
        [x + 1, z, [1, 0, 0]],
        [x - 1, z, [-1, 0, 0]],
        [x, z + 1, [0, 0, 1]],
        [x, z - 1, [0, 0, -1]],
      ];
      for (const [nx, nz, n] of sides) {
        const inside = nx >= 0 && nz >= 0 && nx < size && nz < size;
        const nh = inside ? world.tiles[idx(nx, nz, size)].h : -1;
        if (nh >= tile.h) continue;
        const yb = tileTopY(Math.max(0, nh));
        const c = shade(sideHex, jitter - 0.04);
        if (n[0] === 1) b.quad([x1, yb, z1], [x1, yb, z0], [x1, y, z0], [x1, y, z1], n, c);
        else if (n[0] === -1) b.quad([x0, yb, z0], [x0, yb, z1], [x0, y, z1], [x0, y, z0], n, c);
        else if (n[2] === 1) b.quad([x0, yb, z1], [x1, yb, z1], [x1, y, z1], [x0, y, z1], n, c);
        else b.quad([x1, yb, z0], [x0, yb, z0], [x0, y, z0], [x1, y, z0], n, c);
      }
    }
  }
  return b.build();
}

export function buildWaterMesh(world: World) {
  const size = world.size;
  const g = new THREE.PlaneGeometry(size, size);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.MeshLambertMaterial({
    color: 0x2b6ea8,
    transparent: true,
    opacity: 0.82,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.position.y = seaY();
  mesh.renderOrder = 1;
  return mesh;
}

export function buildRoadGeometry(world: World) {
  const b = new GeoBuilder();
  const size = world.size;
  const off = -size / 2;
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const tile = world.tiles[idx(x, z, size)];
      if (tile.zone !== "road") continue;
      const y = tileTopY(tile.h) + 0.02;
      const x0 = off + x;
      const z0 = off + z;
      b.quad(
        [x0, y, z0 + 1],
        [x0 + 1, y, z0 + 1],
        [x0 + 1, y, z0],
        [x0, y, z0],
        [0, 1, 0],
        shade(ROAD_COLOR, (hash2(x, z, 5) - 0.5) * 0.08),
      );
      // Centre dashes.
      const dash = shade(ROAD_LINE, -0.05);
      b.quad(
        [x0 + 0.44, y + 0.005, z0 + 0.75],
        [x0 + 0.56, y + 0.005, z0 + 0.75],
        [x0 + 0.56, y + 0.005, z0 + 0.25],
        [x0 + 0.44, y + 0.005, z0 + 0.25],
        [0, 1, 0],
        dash,
      );
    }
  }
  return b.build();
}

interface BuildingGeos {
  body: THREE.BufferGeometry;
  windows: THREE.BufferGeometry;
}

const RES_COLORS = [0xd9705b, 0xe0c07a, 0xc9d6c1, 0xb0705a, 0xe8dcc0];
const COM_COLORS = [0x5ba8d8, 0x7fd0e0, 0xd0e4ef, 0x4d7fa8];
const IND_COLORS = [0xb0aca0, 0x9aa3a8, 0xc4b48f];

export function buildPropGeometries(world: World): BuildingGeos {
  const body = new GeoBuilder();
  const win = new GeoBuilder();
  const size = world.size;
  const off = -size / 2;

  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const tile = world.tiles[idx(x, z, size)];
      const bx = off + x;
      const bz = off + z;
      const y = tileTopY(tile.h);
      const r = hash2(x, z, world.seed + 999);
      const r2 = hash2(x + 7, z - 3, world.seed + 4242);

      if (tile.zone === "none" && tile.tree && tile.terrain !== "water") {
        const cx = bx + 0.3 + r * 0.3;
        const cz = bz + 0.3 + r2 * 0.3;
        const s = 0.22 + r * 0.12;
        body.box(cx - 0.05, y, cz - 0.05, 0.1, 0.22, 0.1, 0x6b4a2b);
        body.box(cx - s / 2, y + 0.18, cz - s / 2, s, s * 1.3, s, r > 0.7 ? 0x3f7d3a : 0x4e9b45, r2 * 0.12 - 0.06);
        continue;
      }

      if (tile.level <= 0) continue;

      if (tile.zone === "park") {
        body.box(bx + 0.06, y + 0.01, bz + 0.06, 0.88, 0.04, 0.88, 0x4fae62);
        const n = 2 + ((r * 3) | 0);
        for (let i = 0; i < n; i++) {
          const hx = hash2(x * 13 + i, z, 17);
          const hz = hash2(x, z * 13 + i, 29);
          const cx = bx + 0.15 + hx * 0.6;
          const cz = bz + 0.15 + hz * 0.6;
          body.box(cx - 0.04, y + 0.04, cz - 0.04, 0.08, 0.18, 0.08, 0x6b4a2b);
          body.box(cx - 0.11, y + 0.18, cz - 0.11, 0.22, 0.26, 0.22, 0x3f8f43, hx * 0.1 - 0.05);
        }
        continue;
      }

      const lvl = tile.level;
      if (tile.zone === "residential") {
        const w = 0.52 + r * 0.16;
        const d = 0.5 + r2 * 0.18;
        const h = BLOCK_H * (1.1 + lvl * (0.9 + r * 0.5));
        const px = bx + (1 - w) / 2;
        const pz = bz + (1 - d) / 2;
        const color = RES_COLORS[(r * RES_COLORS.length) | 0];
        body.box(px, y, pz, w, h, d, color, r2 * 0.1 - 0.05);
        // Roof.
        body.box(px + 0.04, y + h, pz + 0.04, w - 0.08, BLOCK_H * 0.4, d - 0.08, 0x8c4a3c);
        addWindows(win, px, y, pz, w, h, d, lvl, x, z, 0xffd98a);
      } else if (tile.zone === "commercial") {
        const w = 0.6 + r * 0.14;
        const d = 0.58 + r2 * 0.14;
        const h = BLOCK_H * (1.4 + lvl * (1.5 + r));
        const px = bx + (1 - w) / 2;
        const pz = bz + (1 - d) / 2;
        const color = COM_COLORS[(r2 * COM_COLORS.length) | 0];
        body.box(px, y, pz, w, h, d, color, r * 0.08 - 0.04);
        if (lvl >= 3) body.box(px + 0.14, y + h, pz + 0.14, w - 0.28, BLOCK_H * (0.5 + r), d - 0.28, color, -0.1);
        addWindows(win, px, y, pz, w, h, d, lvl + 1, x, z, 0xbfefff);
      } else {
        const w = 0.76;
        const d = 0.72;
        const h = BLOCK_H * (1 + lvl * 0.55);
        const px = bx + (1 - w) / 2;
        const pz = bz + (1 - d) / 2;
        const color = IND_COLORS[(r * IND_COLORS.length) | 0];
        body.box(px, y, pz, w, h, d, color, r2 * 0.08 - 0.04);
        const chimneyH = BLOCK_H * (1.2 + lvl * 0.5);
        body.box(px + 0.1, y + h, pz + 0.1, 0.14, chimneyH, 0.14, 0xa8564a);
        if (lvl >= 3) body.box(px + 0.42, y + h, pz + 0.36, 0.14, chimneyH * 0.7, 0.14, 0xa8564a);
        addWindows(win, px, y, pz, w, h, d, Math.min(2, lvl), x, z, 0xffe6a8);
      }
    }
  }

  return { body: body.build(), windows: win.build() };
}

function addWindows(
  b: GeoBuilder,
  px: number,
  y: number,
  pz: number,
  w: number,
  h: number,
  d: number,
  lvl: number,
  x: number,
  z: number,
  hex: number,
) {
  const rows = Math.min(4, lvl);
  const s = 0.09;
  for (let row = 0; row < rows; row++) {
    const wy = y + BLOCK_H * 0.55 + (h - BLOCK_H * 0.7) * (row / Math.max(1, rows));
    if (wy + s > y + h) continue;
    const jitter = hash2(x + row * 3, z, 61);
    if (jitter > 0.82) continue;
    b.box(px + w * 0.25, wy, pz + d + 0.001, s, s, 0.01, hex);
    b.box(px + w * 0.6, wy, pz + d + 0.001, s, s, 0.01, hex);
    b.box(px + w + 0.001, wy, pz + d * 0.3, 0.01, s, s, hex);
  }
}

const OVERLAY_ZONES: Zone[] = ["residential", "commercial", "industrial", "park"];

export function buildOverlayGeometry(world: World, mode: "traffic" | "zones") {
  const b = new GeoBuilder();
  const size = world.size;
  const off = -size / 2;
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const tile = world.tiles[idx(x, z, size)];
      let color: THREE.Color | null = null;
      if (mode === "traffic") {
        if (tile.zone !== "road") continue;
        const t = Math.min(1, tile.traffic);
        color = tmpColor.clone().setHSL(0.33 * (1 - t), 0.85, 0.5);
      } else {
        if (!OVERLAY_ZONES.includes(tile.zone)) continue;
        color = new THREE.Color(ZONE_COLOR[tile.zone]);
      }
      const y = tileTopY(tile.h) + 0.06;
      const x0 = off + x + 0.05;
      const z0 = off + z + 0.05;
      b.quad([x0, y, z0 + 0.9], [x0 + 0.9, y, z0 + 0.9], [x0 + 0.9, y, z0], [x0, y, z0], [0, 1, 0], color);
    }
  }
  return b.build();
}
