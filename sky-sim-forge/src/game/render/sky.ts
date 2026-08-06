import * as THREE from "three";

const VERT = `
varying vec3 vPos;
void main() {
  vPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = `
uniform vec3 topColor;
uniform vec3 bottomColor;
uniform float bands;
varying vec3 vPos;
void main() {
  float h = normalize(vPos).y * 0.5 + 0.5;
  // Quantise the gradient into bands for a retro look.
  float q = floor(h * bands) / bands;
  gl_FragColor = vec4(mix(bottomColor, topColor, clamp(q, 0.0, 1.0)), 1.0);
}
`;

export function createSky() {
  const geo = new THREE.SphereGeometry(420, 24, 16);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color(0x2a6fd6) },
      bottomColor: { value: new THREE.Color(0x9fd8f2) },
      bands: { value: 14 },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: THREE.BackSide,
    depthWrite: false,
  });
  return new THREE.Mesh(geo, mat);
}

export function createStars(count = 320) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 0.9);
    const r = 360;
    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.cos(phi);
    pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 2.4,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  return new THREE.Points(geo, mat);
}
