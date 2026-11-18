import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { getTerrainHeight, PAVILION_POS, TERRAIN_SIZE } from '../../utils/terrain';

type Point = [number, number];
type Seed = { u: number; v: number; id: number };
const START = 4.2;
const END = TERRAIN_SIZE / 2;
const CELL = 0.14;
const PATCH = 2;

function pathX(z: number) { return PAVILION_POS[0] + Math.sin((z - 4.4) * 0.19) * 1.2; }
function hash(a: number, b = 0) {
  let value = Math.imul(a + 497, 374761393) ^ Math.imul(b + 131, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}
function world(u: number, v: number, lift: number): THREE.Vector3 {
  const slope = Math.cos((v - 4.4) * 0.19) * 1.2 * 0.19;
  const norm = 1 / Math.sqrt(1 + slope * slope);
  const x = pathX(v) + u * norm, z = v - u * slope * norm;
  return new THREE.Vector3(x, getTerrainHeight(x, z) + lift, z);
}

// Clip a convex cell to the perpendicular bisector of two irregularly placed
// seeds. Neighbouring stones consequently fit together without a bead grid.
function clip(polygon: Point[], a: Seed, b: Seed): Point[] {
  const nx = b.u - a.u, ny = b.v - a.v;
  const limit = (b.u * b.u + b.v * b.v - a.u * a.u - a.v * a.v) / 2;
  const result: Point[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i], q = polygon[(i + 1) % polygon.length];
    const dp = p[0] * nx + p[1] * ny - limit, dq = q[0] * nx + q[1] * ny - limit;
    if (dp <= 0) result.push(p);
    if ((dp < 0 && dq > 0) || (dp > 0 && dq < 0)) {
      const t = dp / (dp - dq);
      result.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return result;
}
function rounded(polygon: Point[]): Point[] {
  const result: Point[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const previous = polygon[(i + polygon.length - 1) % polygon.length];
    const p = polygon[i], next = polygon[(i + 1) % polygon.length];
    const a: Point = [p[0] * 0.52 + previous[0] * 0.48, p[1] * 0.52 + previous[1] * 0.48];
    const b: Point = [p[0] * 0.52 + next[0] * 0.48, p[1] * 0.52 + next[1] * 0.48];
    for (let step = 0; step < 3; step++) {
      const t = step / 3, r = 1 - t;
      result.push([r * r * a[0] + 2 * r * t * p[0] + t * t * b[0],
        r * r * a[1] + 2 * r * t * p[1] + t * t * b[1]]);
    }
  }
  return result;
}

type MeshData = { positions: number[]; colors: number[]; indices: number[] };
function addStone(data: MeshData, outline: Point[], center: Point, origin: THREE.Vector3,
  color: THREE.Color, height: number, detailed: boolean) {
  const rings = detailed ? [0.48, 0.83, 1] : [1];
  const offset = data.positions.length / 3;
  const put = (u: number, v: number, lift: number, shade: number) => {
    const p = world(u, v, 0.012 + lift).sub(origin);
    data.positions.push(p.x, p.y, p.z);
    data.colors.push(color.r * shade, color.g * shade, color.b * shade);
  };
  put(center[0], center[1], height, 1);
  const n = outline.length;
  for (const r of rings) {
    const elevation = height * Math.pow(Math.max(0, 1 - Math.pow(r, 3.6)), 0.7);
    for (const point of outline) {
      put(center[0] + (point[0] - center[0]) * r, center[1] + (point[1] - center[1]) * r,
        elevation + 0.001, 1 - Math.pow(r, 5) * 0.23);
    }
  }
  for (let i = 0; i < n; i++) data.indices.push(offset, offset + 1 + (i + 1) % n, offset + 1 + i);
  for (let ring = 0; ring < rings.length - 1; ring++) {
    for (let i = 0; i < n; i++) {
      const a = offset + 1 + ring * n + i, b = offset + 1 + ring * n + (i + 1) % n;
      const c = a + n, d = b + n;
      data.indices.push(a, b, c, b, d, c);
    }
  }
}
function geometry(data: MeshData) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(data.colors, 3));
  geo.setIndex(data.indices); geo.computeVertexNormals(); geo.computeBoundingSphere();
  return geo;
}
function empty(): MeshData { return { positions: [], colors: [], indices: [] }; }

function buildPaving() {
  const seeds = new Map<string, Seed>();
  const rowCount = Math.ceil((END - START) / CELL);
  for (let row = -2; row <= rowCount + 2; row++) {
    for (let column = -9; column <= 9; column++) {
      const id = (row + 3) * 23 + column + 10;
      if (hash(id, 17) < 0.09) continue;
      seeds.set(`${column},${row}`, { u: column * CELL + (hash(id, 2) - 0.5) * CELL * 0.85,
        v: START + row * CELL + (hash(id, 3) - 0.5) * CELL * 0.85, id });
    }
  }
  const patches = Array.from({ length: Math.ceil((END - START) / PATCH) }, (_, i) => {
    const v = START + (i + 0.5) * PATCH;
    return { origin: world(0, v, 0), near: empty(), far: empty() };
  });
  const palette = ['#5a554b', '#61594e', '#56554d', '#686052', '#5b594e', '#5e574b', '#605c52'];
  for (let row = 0; row <= rowCount; row++) {
    for (let column = -6; column <= 6; column++) {
      const seed = seeds.get(`${column},${row}`);
      if (!seed || seed.v < START || seed.v > END || Math.abs(seed.u) > 0.82) continue;
      const width = 0.82 + Math.sin(seed.v * 1.7) * 0.025;
      let polygon: Point[] = [[-width, START], [width, START], [width, END], [-width, END]];
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const neighbor = seeds.get(`${column + dx},${row + dy}`);
        if (neighbor && neighbor !== seed && polygon.length) polygon = clip(polygon, seed, neighbor);
      }
      if (polygon.length < 3) continue;
      const center: Point = [polygon.reduce((s, p) => s + p[0], 0) / polygon.length,
        polygon.reduce((s, p) => s + p[1], 0) / polygon.length];
      const gap = 0.87 + hash(seed.id, 9) * 0.06;
      polygon = polygon.map(p => [center[0] + (p[0] - center[0]) * gap, center[1] + (p[1] - center[1]) * gap]);
      const patch = patches[Math.min(patches.length - 1, Math.floor((seed.v - START) / PATCH))];
      const color = new THREE.Color(palette[Math.floor(hash(seed.id, 8) * palette.length)]);
      const height = 0.007 + hash(seed.id, 11) * 0.012;
      addStone(patch.near, rounded(polygon), center, patch.origin, color, height, true);
      addStone(patch.far, rounded(polygon), center, patch.origin, color, 0.004, false);
    }
  }
  return patches.filter(patch => patch.near.positions.length).map(patch => ({
    origin: patch.origin, near: geometry(patch.near), far: geometry(patch.far),
  }));
}

// No image textures: fitted stone cells, rounded shallow crowns and recessed
// soil joints are generated together. Distant patches use simplified geometry.
export const PebblePath: React.FC = () => {
  const patches = useMemo(buildPaving, []);
  const material = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.77, metalness: 0 });
    mat.onBeforeCompile = shader => {
      shader.uniforms.pavingMud = { value: new THREE.Color('#514839') };
      shader.vertexShader = 'varying vec3 pavingWorld;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        pavingWorld=(modelMatrix*vec4(transformed,1.0)).xyz;`);
      shader.fragmentShader = 'uniform vec3 pavingMud;\nvarying vec3 pavingWorld;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        float grain=sin(pavingWorld.x*331.0)*sin(pavingWorld.z*287.0);
        float visibility=1.0-smoothstep(0.01,0.05,length(fwidth(pavingWorld.xz)));
        diffuseColor.rgb*=1.0+grain*0.035*visibility;
        float centerX=2.2+sin((pavingWorld.z-4.4)*0.19)*1.2;
        float earthEdge=smoothstep(0.42,0.83,abs(pavingWorld.x-centerX));
        diffuseColor.rgb=mix(diffuseColor.rgb,pavingMud,0.06+earthEdge*0.42);`);
    };
    mat.customProgramCacheKey = () => 'procedural-fitted-pebbles-v2';
    return mat;
  }, []);
  const lods = useMemo(() => patches.map(patch => {
    const lod = new THREE.LOD();
    lod.position.copy(patch.origin);
    const near = new THREE.Mesh(patch.near, material), far = new THREE.Mesh(patch.far, material);
    near.receiveShadow = far.receiveShadow = true;
    lod.addLevel(near, 0); lod.addLevel(far, 8, 0.1);
    return lod;
  }), [patches, material]);
  useEffect(() => () => {
    patches.forEach(patch => { patch.near.dispose(); patch.far.dispose(); }); material.dispose();
  }, [patches, material]);
  return <group>{lods.map((lod, i) => <primitive key={i} object={lod} />)}</group>;
};
