import { useSceneTextures } from '../../utils/useSceneTextures';
import React, { useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';

import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useAppStore } from '../../stores/useAppStore';
import { bambooDetailAtDistance, type BambooDetail } from '../../utils/bambooLod';
import { getTerrainHeight } from '../../utils/terrain';
import { createBambooLayout, type BambooInstance } from '../../utils/bambooLayout';

interface BambooForestProps { count?: number }

function seededRandom(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function tint(geometry: THREE.BufferGeometry, color: THREE.Color) {
  const colors = new Float32Array(geometry.attributes.position.count * 3);
  for (let i = 0; i < colors.length; i += 3) color.toArray(colors, i);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

// Four different culms: irregular internodes, continuous thin joints, tapered
// tips and a gently curved upper stem. All geometry is shared by instances.
function createBamboo(variant: number, detail: BambooDetail = 0) {
  const tubeSteps = [3, 2, 1][detail], sides = [10, 6, 4][detail];
  const random = seededRandom(305 + variant * 197);
  const height = 8.4 + variant * 0.65;
  const radius = 0.051 + variant * 0.004;
  const bend = 0.2 + random() * 0.55;
  const bendZ = (random() - 0.5) * 0.6;
  const center = (y: number) => new THREE.Vector3(bend * (y / height) ** 2.6, y, bendZ * (y / height) ** 2);
  const stemRadius = (y: number) => radius * (1 - 0.88 * (y / height) ** 1.25);
  const stems: THREE.BufferGeometry[] = [];
  const leaves: THREE.BufferGeometry[] = [];
  const nodes = [0];
  while (nodes[nodes.length - 1] < height) {
    const y = nodes[nodes.length - 1];
    nodes.push(Math.min(height, y + (0.43 + random() * 0.22) * (1 - 0.28 * y / height)));
  }

  const stemColor = new THREE.Color(['#eceee2', '#e4e9df', '#f2ead9', '#dee6d7'][variant]);
  for (let node = 0; node < nodes.length - 1; node++) {
    const bottom = nodes[node];
    const top = nodes[node + 1];
    const curve = new THREE.CatmullRomCurve3([center(bottom), center((bottom + top) / 2), center(top)]);
    const segment = new THREE.TubeGeometry(curve, tubeSteps, 1, sides, false);
    const positions = segment.attributes.position;
    // TubeGeometry supplies a local circular frame; scale its unit radius
    // around the centerline to get a continuous taper without gaps.
    for (let ring = 0; ring <= tubeSteps; ring++) {
      const y = THREE.MathUtils.lerp(bottom, top, ring / tubeSteps);
      const c = curve.getPointAt(ring / tubeSteps);
      const r = stemRadius(y) * (1 - 0.025 * Math.sin(ring / tubeSteps * Math.PI));
      for (let side = 0; side <= sides; side++) {
        const i = ring * (sides + 1) + side;
        positions.setXYZ(i, c.x + (positions.getX(i) - c.x) * r,
          c.y + (positions.getY(i) - c.y) * r, c.z + (positions.getZ(i) - c.z) * r);
      }
    }
    const uv = segment.attributes.uv;
    for (let ring = 0; ring <= tubeSteps; ring++) {
      for (let side = 0; side <= sides; side++) {
        // Use exactly one photographed internode, between the two node bands.
        // TubeGeometry's default axes run the other way around.
        uv.setXY(ring * (sides + 1) + side, side / sides, 0.254 + ring / tubeSteps * 0.436);
      }
    }
    segment.computeVertexNormals();
    stems.push(tint(segment, stemColor.clone().multiplyScalar(0.96 + random() * 0.08)));

    if (top < height && detail < 2) {
      const joint = new THREE.CylinderGeometry(stemRadius(top) * 1.055, stemRadius(top) * 1.045, 0.012, sides);
      joint.translate(...center(top).toArray());
      stems.push(tint(joint, new THREE.Color('#d9ddcb')));
      if (detail === 0) {
      const seam = new THREE.CylinderGeometry(stemRadius(top) * 1.015, stemRadius(top) * 1.015, 0.007, 10);
      seam.translate(...center(top - 0.012).toArray());
      stems.push(tint(seam, new THREE.Color('#aab59b')));
      }
    }
  }

  function twig(points: THREE.Vector3[], width: number) {
    const stride = detail === 0 ? 1 : detail === 1 ? 2 : points.length - 1;
    for (let i = 0; i < points.length - 1; i += stride) {
      const a = points[i];
      const b = points[Math.min(points.length - 1, i + stride)];
      const direction = b.clone().sub(a);
      const geo = new THREE.CylinderGeometry(width * (1 - (i + 1) / points.length * 0.8),
        width * (1 - i / points.length * 0.8), direction.length(), detail === 0 ? 5 : 3);
      geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()));
      geo.translate(...a.clone().add(b).multiplyScalar(0.5).toArray());
      stems.push(tint(geo, stemColor.clone().multiplyScalar(0.8)));
    }
  }

  function foliageSpray(base: THREE.Vector3, azimuth: number, size: number) {
    // The generated spray contains its own fine twigs and individual leaves.
    // A lightly curved card preserves the photographic silhouette; varying
    // its direction avoids the flat, repeated fans of the previous geometry.
    const geo = new THREE.PlaneGeometry(size, size * 2 / 3, [4, 2, 1][detail], detail === 0 ? 3 : 1);
    const positions = geo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i) + size / 2;
      const y = positions.getY(i) + size / 3;
      positions.setXYZ(i, x, y, -0.09 * size * Math.pow(x / size, 2));
    }
    geo.rotateX((random() - 0.5) * 0.9);
    geo.rotateZ(-0.48 - random() * 0.28);
    geo.rotateY(-azimuth);
    geo.translate(...base.toArray());
    geo.computeVertexNormals();
    leaves.push(tint(geo, new THREE.Color('#f1f3e9').multiplyScalar(0.92 + random() * 0.08)));
  }

  for (let node = 0; node < nodes.length - 2; node++) {
    const y = nodes[node];
    if (y < height * 0.37 || node % 2 !== variant % 2) continue;
    const branchCount = y > height * 0.65 ? 2 : 1;
    for (let branch = 0; branch < branchCount; branch++) {
      const azimuth = node * 2.399 + branch * 2.5 + random() * 0.6;
      const reach = (0.85 + random() * 0.75) * (1 - 0.4 * y / height);
      const root = center(y);
      const branchPoint = (t: number) => root.clone().add(new THREE.Vector3(
        Math.cos(azimuth) * reach * t,
        0.48 * Math.sin(Math.PI * t * 0.8) - 0.32 * t * t,
        Math.sin(azimuth) * reach * t));
      twig(Array.from({ length: 6 }, (_, i) => branchPoint(i / 5)), 0.009);
      for (let spray = 0; spray < 2; spray++) {
        const t = 0.45 + spray * 0.4;
        const side = spray % 2 === 0 ? 1 : -1;
        const angle = azimuth + side * (0.4 + random() * 0.45);
        foliageSpray(branchPoint(t), angle, 0.85 + random() * 0.4);
      }
    }
  }
  const trunkGeo = mergeGeometries(stems, false)!;
  const leavesGeo = mergeGeometries(leaves, false)!;
  stems.forEach(geo => geo.dispose());
  leaves.forEach(geo => geo.dispose());
  return { trunkGeo, leavesGeo };
}



function BambooBatch({ variant, instances, trunkMaterial, leavesMaterial, depthMaterial }: {
  variant: number; instances: BambooInstance[]; trunkMaterial: THREE.MeshStandardMaterial;
  leavesMaterial: THREE.MeshStandardMaterial; depthMaterial: THREE.MeshDepthMaterial;
}) {
  const trunks = useRef<(THREE.InstancedMesh | null)[]>([]);
  const foliage = useRef<(THREE.InstancedMesh | null)[]>([]);
  const geometries = useMemo(() => ([0, 1, 2] as const).map(detail => createBamboo(variant, detail)), [variant]);
  const records = useMemo(() => {
    const pose = new THREE.Object3D();
    return instances.map(instance => {
      pose.position.set(instance.x, getTerrainHeight(instance.x, instance.z), instance.z);
      pose.rotation.set(instance.lean, instance.rotation, instance.lean * 0.6);
      pose.scale.set(instance.scaleXZ, instance.scaleY, instance.scaleXZ); pose.updateMatrix();
      return { instance, matrix: pose.matrix.clone(), detail: -1 };
    });
  }, [instances]);
  const camera = useThree(state => state.camera);
  const lastCamera = useMemo(() => new THREE.Vector3(Infinity, Infinity, Infinity), []);
  const timer = useRef(1), dirty = useRef(true);
  const updateBatches = useCallback((view: THREE.Camera) => {
    lastCamera.copy(view.position);
    let changed = dirty.current;
    for (const record of records) {
      const distance = Math.hypot(record.instance.x - view.position.x, record.instance.z - view.position.z);
      const detail = bambooDetailAtDistance(distance, record.detail);
      if (record.detail !== detail) { record.detail = detail; changed = true; }
    }
    if (!changed) return;
    dirty.current = false;
    const counts = [0, 0, 0];
    for (const record of records) {
      const detail = record.detail, index = counts[detail]++;
      for (const mesh of [trunks.current[detail], foliage.current[detail]]) {
        mesh!.setMatrixAt(index, record.matrix); mesh!.setColorAt(index, record.instance.shade);
      }
    }
    for (let detail = 0; detail < 3; detail++) {
      for (const mesh of [trunks.current[detail], foliage.current[detail]]) {
        mesh!.count = counts[detail]; mesh!.instanceMatrix.needsUpdate = true;
        if (mesh!.instanceColor) mesh!.instanceColor!.needsUpdate = true;
        mesh!.computeBoundingSphere();
        if (mesh!.boundingSphere) mesh!.boundingSphere!.radius += 2;
      }
    }
  }, [records, lastCamera]);
  useLayoutEffect(() => {
    dirty.current = true;
    for (const mesh of [...trunks.current, ...foliage.current]) {
      if (mesh) { mesh.count = 0; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); }
    }
    // Populate before the stream and soil capture their first reflection probes.
    updateBatches(camera);
  }, [records, geometries, camera, updateBatches]);
  useFrame(({ camera: view }, delta) => {
    timer.current += delta;
    if (!dirty.current && (timer.current < 0.2 || view.position.distanceToSquared(lastCamera) < 0.12)) return;
    timer.current = 0;
    updateBatches(view);
  });
  useEffect(() => () => { geometries.forEach(g => { g.trunkGeo.dispose(); g.leavesGeo.dispose(); }); }, [geometries]);
  return <group>{geometries.map((geometry, detail) => <group key={detail}>
    <instancedMesh ref={mesh => { trunks.current[detail] = mesh; }}
      args={[geometry.trunkGeo, trunkMaterial, instances.length]}
      customDepthMaterial={depthMaterial} castShadow={detail < 2} receiveShadow />
    <instancedMesh ref={mesh => { foliage.current[detail] = mesh; }}
      args={[geometry.leavesGeo, leavesMaterial, instances.length]} receiveShadow />
  </group>)}</group>;
}

export const BambooForest: React.FC<BambooForestProps> = ({ count }) => {
  const bambooCount = useAppStore(state => state.config.bambooCount);
  const bambooClearance = useAppStore(state => state.config.bambooClearance);
  const bambooDensity = useAppStore(state => state.config.bambooDensity);

  const finalCount = count ?? bambooCount;
  const textures = useSceneTextures({
    culm: '/textures/bamboo/culm-v1.png',
    foliage: '/textures/bamboo/foliage-v1.png',
  });
  useEffect(() => {
    textures.culm.wrapS = THREE.RepeatWrapping;
    textures.culm.wrapT = THREE.ClampToEdgeWrapping;
    Object.values(textures).forEach(texture => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
      texture.needsUpdate = true;
    });
  }, [textures]);
  const groups = useMemo(
    () => createBambooLayout(finalCount, bambooClearance, bambooDensity),
    [finalCount, bambooClearance, bambooDensity]
  );
  const materials = useMemo(() => {
    const time = { value: 0 };
    const wind = { value: 1 };
    const trunk = new THREE.MeshStandardMaterial({ map: textures.culm, vertexColors: true, roughness: 0.88, metalness: 0 });
    const leaves = new THREE.MeshStandardMaterial({ map: textures.foliage, vertexColors: true,
      alphaTest: 0.65, alphaToCoverage: true, roughness: 0.86, metalness: 0, side: THREE.DoubleSide });
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
    for (const material of [trunk, leaves, depth]) {
      material.onBeforeCompile = shader => {
        shader.uniforms.bambooTime = time;
        shader.uniforms.bambooWind = wind;
        shader.vertexShader = 'uniform float bambooTime;\nuniform float bambooWind;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
          #include <begin_vertex>
          float phase = instanceMatrix[3].x * 0.43 + instanceMatrix[3].z * 0.31;
          float flex = pow(clamp(position.y / 10.0, 0.0, 1.3), 2.0);
          transformed.x += sin(bambooTime * 0.7 + phase) * 0.18 * bambooWind * flex;
          transformed.z += sin(bambooTime * 0.54 + phase + 1.5) * 0.12 * bambooWind * flex;
        `);
      };
      material.customProgramCacheKey = () => 'bamboo-flex-v1';
    }
    return { trunk, leaves, depth, time, wind };
  }, [textures]);

  // 风速在 useFrame 内由 getState() 高性能直接读取，完全不触发 React 组件重渲染与网格重建！
  useFrame(state => {
    materials.time.value = state.clock.elapsedTime;
    materials.wind.value = useAppStore.getState().config.windSpeed;
  });
  useEffect(() => () => {
    materials.trunk.dispose(); materials.leaves.dispose(); materials.depth.dispose();
  }, [materials]);
  return <group>{groups.map((instances, variant) => <BambooBatch key={`batch-${variant}-${instances.length}`} variant={variant} instances={instances}
    trunkMaterial={materials.trunk} leavesMaterial={materials.leaves} depthMaterial={materials.depth} />)}</group>;
};
