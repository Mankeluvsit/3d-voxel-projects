import * as THREE from "three";
import { GRID } from "../config";
import type { Car } from "../traffic";
import type { Overlay, World } from "../types";
import { idx } from "../world";
import {
  buildOverlayGeometry,
  buildPropGeometries,
  buildRoadGeometry,
  buildTerrainGeometry,
  buildWaterMesh,
  tileTopY,
} from "./meshes";
import { createSky, createStars } from "./sky";

const ISO_PITCH = Math.atan(1 / Math.SQRT2); // classic isometric angle
const MAX_CARS_MESH = 300;

const dayTop = new THREE.Color(0x2f74d8);
const dayBottom = new THREE.Color(0xa9dcf5);
const duskTop = new THREE.Color(0x24306b);
const duskBottom = new THREE.Color(0xef8a5a);
const nightTop = new THREE.Color(0x070b1c);
const nightBottom = new THREE.Color(0x172247);

export class GameScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.OrthographicCamera;

  target = new THREE.Vector3(0, 0, 0);
  yaw = Math.PI / 4;
  private yawTarget = Math.PI / 4;
  zoom = 26;

  private terrain = new THREE.Mesh();
  private roads = new THREE.Mesh();
  private props = new THREE.Mesh();
  private windows = new THREE.Mesh();
  private overlay = new THREE.Mesh();
  private water: THREE.Mesh;
  private sky = createSky();
  private stars = createStars();
  private sun = new THREE.DirectionalLight(0xffffff, 1.6);
  private hemi = new THREE.HemisphereLight(0xbcd8f0, 0x4a4033, 0.8);
  private cars: THREE.InstancedMesh;
  private hover: THREE.Mesh;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private windowMat: THREE.MeshBasicMaterial;
  private overlayMode: Overlay = "none";
  private size = GRID;

  constructor(canvas: HTMLCanvasElement, world: World) {
    this.size = world.size;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(1.5, typeof window !== "undefined" ? window.devicePixelRatio : 1));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 1200);

    const solid = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.terrain.material = solid;
    this.terrain.receiveShadow = true;
    this.props.material = solid;
    this.props.castShadow = true;
    this.props.receiveShadow = true;
    this.roads.material = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.roads.receiveShadow = true;

    this.windowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    this.windows.material = this.windowMat;

    this.overlay.material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    this.overlay.visible = false;

    this.water = buildWaterMesh(world);

    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    const cam = this.sun.shadow.camera;
    cam.left = -this.size * 0.6;
    cam.right = this.size * 0.6;
    cam.top = this.size * 0.6;
    cam.bottom = -this.size * 0.6;
    cam.near = 1;
    cam.far = 260;

    this.cars = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.24, 0.16, 0.38),
      new THREE.MeshLambertMaterial(),
      MAX_CARS_MESH,
    );
    this.cars.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.cars.count = 0;
    this.cars.frustumCulled = false;

    const hoverGeo = new THREE.PlaneGeometry(1, 1);
    hoverGeo.rotateX(-Math.PI / 2);
    this.hover = new THREE.Mesh(
      hoverGeo,
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false }),
    );
    this.hover.visible = false;
    this.hover.renderOrder = 5;

    this.scene.add(
      this.sky,
      this.stars,
      this.hemi,
      this.sun,
      this.sun.target,
      this.terrain,
      this.water,
      this.roads,
      this.props,
      this.windows,
      this.overlay,
      this.cars,
      this.hover,
    );

    this.rebuild(world);
    this.updateCamera();
  }

  rebuild(world: World) {
    this.size = world.size;
    this.terrain.geometry?.dispose();
    this.terrain.geometry = buildTerrainGeometry(world);
    this.roads.geometry?.dispose();
    this.roads.geometry = buildRoadGeometry(world);
    const { body, windows } = buildPropGeometries(world);
    this.props.geometry?.dispose();
    this.props.geometry = body;
    this.windows.geometry?.dispose();
    this.windows.geometry = windows;
    if (this.overlayMode !== "none") this.refreshOverlay(world);
  }

  setOverlay(world: World, mode: Overlay) {
    this.overlayMode = mode;
    this.overlay.visible = mode !== "none";
    if (mode !== "none") this.refreshOverlay(world);
  }

  refreshOverlay(world: World) {
    if (this.overlayMode === "none") return;
    this.overlay.geometry?.dispose();
    this.overlay.geometry = buildOverlayGeometry(world, this.overlayMode);
  }

  setHover(world: World, x: number | null, z: number | null, valid: boolean) {
    if (x === null || z === null) {
      this.hover.visible = false;
      return;
    }
    const off = -world.size / 2;
    const tile = world.tiles[idx(x, z, world.size)];
    this.hover.visible = true;
    this.hover.position.set(off + x + 0.5, tileTopY(tile.h) + 0.08, off + z + 0.5);
    (this.hover.material as THREE.MeshBasicMaterial).color.set(valid ? 0xffffff : 0xff4d4d);
  }

  /** Screen coords -> tile indices, via a raycast onto the terrain. */
  pick(clientX: number, clientY: number, world: World): { x: number; z: number } | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects([this.terrain, this.water], false);
    if (!hits.length) return null;
    const p = hits[0].point;
    const off = -world.size / 2;
    const x = Math.floor(p.x - off);
    const z = Math.floor(p.z - off);
    if (x < 0 || z < 0 || x >= world.size || z >= world.size) return null;
    return { x, z };
  }

  updateCars(world: World, cars: Car[]) {
    const off = -world.size / 2;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);
    const pos = new THREE.Vector3();
    const count = Math.min(cars.length, MAX_CARS_MESH);
    for (let i = 0; i < count; i++) {
      const car = cars[i];
      const a = car.path[car.seg];
      const b = car.path[Math.min(car.seg + 1, car.path.length - 1)];
      const ax = a % world.size;
      const az = (a / world.size) | 0;
      const bx = b % world.size;
      const bz = (b / world.size) | 0;
      const ta = world.tiles[a];
      const tb = world.tiles[b];
      const t = car.t;
      // Offset to the right-hand lane so opposing cars don't overlap.
      const dirX = bx - ax;
      const dirZ = bz - az;
      const laneX = -dirZ * 0.16;
      const laneZ = dirX * 0.16;
      pos.set(
        off + ax + 0.5 + (bx - ax) * t + laneX,
        THREE.MathUtils.lerp(tileTopY(ta.h), tileTopY(tb.h), t) + 0.12,
        off + az + 0.5 + (bz - az) * t + laneZ,
      );
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(dirX, dirZ));
      m.compose(pos, q, scale);
      this.cars.setMatrixAt(i, m);
      this.cars.setColorAt(i, new THREE.Color(car.color));
    }
    this.cars.count = count;
    this.cars.instanceMatrix.needsUpdate = true;
    if (this.cars.instanceColor) this.cars.instanceColor.needsUpdate = true;
  }

  /** dayTime 0..1 where 0.25 is sunrise and 0.75 is sunset. */
  setDayTime(t: number) {
    const angle = (t - 0.25) * Math.PI * 2;
    const elevation = Math.sin(angle);
    const radius = 90;
    this.sun.position.set(
      this.target.x + Math.cos(angle) * radius * 0.6,
      Math.max(-30, elevation * radius),
      this.target.z + Math.cos(angle) * radius * 0.4 + 30,
    );
    this.sun.target.position.copy(this.target);
    this.sun.target.updateMatrixWorld();

    const day = THREE.MathUtils.clamp(0.12 + elevation * 3.0, 0, 1);
    const dusk = THREE.MathUtils.clamp(1 - Math.abs(elevation) * 3.2, 0, 1);
    const night = THREE.MathUtils.clamp(-elevation * 2.6, 0, 1);

    this.sun.intensity = 0.35 + day * 1.5;
    this.sun.color.setHSL(0.11, 0.35 * dusk, 0.55 + day * 0.45);
    this.hemi.intensity = 0.55 + day * 0.6;

    const top = nightTop.clone().lerp(duskTop, dusk).lerp(dayTop, day);
    const bottom = nightBottom.clone().lerp(duskBottom, dusk).lerp(dayBottom, day);
    const uni = (this.sky.material as THREE.ShaderMaterial).uniforms;
    uni.topColor.value.copy(top);
    uni.bottomColor.value.copy(bottom);
    (this.stars.material as THREE.PointsMaterial).opacity = night;
    this.scene.background = null;

    // Windows glow after dark.
    const glow = 0.18 + night * 0.82;
    this.windowMat.color.setScalar(glow);
  }

  rotate(dir: number) {
    this.yawTarget += (dir * Math.PI) / 2;
  }

  pan(dxPx: number, dyPx: number) {
    const scale = this.zoom / Math.max(1, this.renderer.domElement.clientHeight * 0.5);
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    this.target.addScaledVector(right, -dxPx * scale);
    this.target.addScaledVector(fwd, -dyPx * scale * 1.6);
    this.clampTarget();
  }

  zoomBy(factor: number) {
    this.zoom = THREE.MathUtils.clamp(this.zoom * factor, 6, 60);
  }

  private clampTarget() {
    const lim = this.size * 0.6;
    this.target.x = THREE.MathUtils.clamp(this.target.x, -lim, lim);
    this.target.z = THREE.MathUtils.clamp(this.target.z, -lim, lim);
  }

  updateCamera(dt = 0) {
    if (dt > 0) this.yaw += (this.yawTarget - this.yaw) * Math.min(1, dt * 8);
    else this.yaw = this.yawTarget;

    const dist = 200;
    const y = Math.sin(ISO_PITCH) * dist;
    const horiz = Math.cos(ISO_PITCH) * dist;
    this.camera.position.set(
      this.target.x + Math.sin(this.yaw) * horiz,
      this.target.y + y,
      this.target.z + Math.cos(this.yaw) * horiz,
    );
    this.camera.lookAt(this.target);
    this.sky.position.copy(this.camera.position);
    this.stars.position.copy(this.camera.position);
    this.applyFrustum();
  }

  private applyFrustum() {
    const el = this.renderer.domElement;
    const aspect = el.clientWidth / Math.max(1, el.clientHeight);
    const half = this.zoom;
    this.camera.left = -half * aspect;
    this.camera.right = half * aspect;
    this.camera.top = half;
    this.camera.bottom = -half;
    this.camera.updateProjectionMatrix();
  }

  resize(width: number, height: number) {
    this.renderer.setSize(width, height, false);
    this.applyFrustum();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      mesh.geometry?.dispose?.();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose?.();
    });
    this.renderer.dispose();
  }
}
