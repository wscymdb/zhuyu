import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useAppStore } from '../../stores/useAppStore';
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
function createBamboo(variant: number) {
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
    const segment = new THREE.TubeGeometry(curve, 3, 1, 10, false);
    const positions = segment.attributes.position;
    // TubeGeometry supplies a local circular frame; scale its unit radius
    // around the centerline to get a continuous taper without gaps.
    for (let ring = 0; ring <= 3; ring++) {
      const y = THREE.MathUtils.lerp(bottom, top, ring / 3);
      const c = curve.getPointAt(ring / 3);
      const r = stemRadius(y) * (1 - 0.025 * Math.sin(ring / 3 * Math.PI));
      for (let side = 0; side <= 10; side++) {
        const i = ring * 11 + side;
        positions.setXYZ(i, c.x + (positions.getX(i) - c.x) * r,
          c.y + (positions.getY(i) - c.y) * r, c.z + (positions.getZ(i) - c.z) * r);
      }
    }
    const uv = segment.attributes.uv;
    for (let ring = 0; ring <= 3; ring++) {
      for (let side = 0; side <= 10; side++) {
        // Use exactly one photographed internode, between the two node bands.
        // TubeGeometry's default axes run the other way around.
        uv.setXY(ring * 11 + side, side / 10, 0.254 + ring / 3 * 0.436);
      }
    }
    segment.computeVertexNormals();
    stems.push(tint(segment, stemColor.clone().multiplyScalar(0.96 + random() * 0.08)));

    if (top < height) {
      const joint = new THREE.CylinderGeometry(stemRadius(top) * 1.055, stemRadius(top) * 1.045, 0.012, 10);
      joint.translate(...center(top).toArray());
      stems.push(tint(joint, new THREE.Color('#d9ddcb')));
      const seam = new THREE.CylinderGeometry(stemRadius(top) * 1.015, stemRadius(top) * 1.015, 0.007, 10);
      seam.translate(...center(top - 0.012).toArray());
      stems.push(tint(seam, new THREE.Color('#aab59b')));
    }
  }

  function twig(points: THREE.Vector3[], width: number) {
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const direction = b.clone().sub(a);
      const geo = new THREE.CylinderGeometry(width * (1 - (i + 1) / points.length * 0.8),
        width * (1 - i / points.length * 0.8), direction.length(), 5);
      geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()));
      geo.translate(...a.clone().add(b).multiplyScalar(0.5).toArray());
      stems.push(tint(geo, stemColor.clone().multiplyScalar(0.8)));
    }
  }

  function foliageSpray(base: THREE.Vector3, azimuth: number, size: number) {
    // The generated spray contains its own fine twigs and individual leaves.
    // A lightly curved card preserves the photographic silhouette; varying
    // its direction avoids the flat, repeated fans of the previous geometry.
    const geo = new THREE.PlaneGeometry(size, size * 2 / 3, 4, 3);
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
  const trunk = useRef<THREE.InstancedMesh>(null);
  const leaves = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => createBamboo(variant), [variant]);

  useLayoutEffect(() => {
    if (!trunk.current || !leaves.current || instances.length === 0) return;
    const dummy = new THREE.Object3D();
    instances.forEach((instance, i) => {
      dummy.position.set(instance.x, getTerrainHeight(instance.x, instance.z), instance.z);
      dummy.rotation.set(instance.lean, instance.rotation, instance.lean * 0.6);
      dummy.scale.set(instance.scaleXZ, instance.scaleY, instance.scaleXZ);
      dummy.updateMatrix();
      trunk.current!.setMatrixAt(i, dummy.matrix);
      trunk.current!.setColorAt(i, instance.shade);
      leaves.current!.setMatrixAt(i, dummy.matrix);
      leaves.current!.setColorAt(i, instance.shade);
    });

    [trunk.current, leaves.current].forEach(mesh => {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      if (mesh.boundingSphere) mesh.boundingSphere.radius += 2.0;
    });
  }, [instances, geometry]);

  useEffect(() => () => { geometry.trunkGeo.dispose(); geometry.leavesGeo.dispose(); }, [geometry]);

  return <group>
    <instancedMesh
      key={`trunk-${variant}-${instances.length}`}
      ref={trunk}
      args={[geometry.trunkGeo, trunkMaterial, instances.length]}
      customDepthMaterial={depthMaterial}
      castShadow
      receiveShadow
    />
    <instancedMesh
      key={`leaves-${variant}-${instances.length}`}
      ref={leaves}
      args={[geometry.leavesGeo, leavesMaterial, instances.length]}
      receiveShadow
    />
  </group>;
}

export const BambooForest: React.FC<BambooForestProps> = ({ count }) => {
  const bambooCount = useAppStore(state => state.config.bambooCount);
  const bambooClearance = useAppStore(state => state.config.bambooClearance);
  const bambooDensity = useAppStore(state => state.config.bambooDensity);

  const finalCount = count ?? bambooCount;
  const textures = useTexture({
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
