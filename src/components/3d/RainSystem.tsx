import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useAppStore } from '../../stores/useAppStore';
import { getTerrainHeight, PAVILION_POS } from '../../utils/terrain';

export const RainSystem: React.FC = () => {
  const rainLinesRef = useRef<THREE.LineSegments>(null);
  const eavesLinesRef = useRef<THREE.LineSegments>(null);
  const rippleMeshRef = useRef<THREE.InstancedMesh>(null);

  const rainType = useAppStore((state) => state.rainType);
  const rainIntensity = useAppStore((state) => state.config.rainIntensity);

  // 1. 真实全景雨丝线段系统 (适度优化数量，保障高帧率丝滑)
  const rainStreakCount = 3800;
  const { lineGeo, rainData } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(rainStreakCount * 2 * 3);
    const data: {
      x: number;
      y: number;
      z: number;
      length: number;
      speed: number;
    }[] = [];

    const slantX = -0.16; // 随微风自然倾斜

    for (let i = 0; i < rainStreakCount; i++) {
      const x = (Math.random() - 0.5) * 45;
      const y = Math.random() * 24;
      const z = (Math.random() - 0.5) * 45;
      const len = 0.6 + Math.random() * 0.45;
      const spd = 28 + Math.random() * 14;

      data.push({ x, y, z, length: len, speed: spd });

      const idx = i * 6;
      // 头部
      positions[idx] = x;
      positions[idx + 1] = y;
      positions[idx + 2] = z;
      // 尾部拉长为细雨丝
      positions[idx + 3] = x - slantX * len;
      positions[idx + 4] = y + len;
      positions[idx + 5] = z;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return { lineGeo: geo, rainData: data };
  }, [rainStreakCount]);

  // 2. 真实屋檐水帘滴落系统：改用微型流线短水丝 (Micro Line Segments)，彻底告别粗笨的白方块！
  const eavesDripCount = 120;
  const { eavesLineGeo, eavesData } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(eavesDripCount * 2 * 3);
    const data: { x: number; y: number; z: number; speed: number; originY: number; len: number }[] = [];

    for (let i = 0; i < eavesDripCount; i++) {
      const edge = Math.floor(Math.random() * 4);
      const t = Math.random() * 2 - 1;
      const angle = edge * Math.PI / 2;
      const x = PAVILION_POS[0] + 4.15 * (t * Math.cos(angle) + Math.sin(angle));
      const z = PAVILION_POS[2] + 4.15 * (Math.cos(angle) - t * Math.sin(angle));
      const originY = 3.6 + 0.07 + 0.2 * Math.pow(Math.abs(t), 6) - 0.06;
      const y = originY - Math.random() * 3.2;
      const len = 0.12 + Math.random() * 0.12; // 短水滴尾迹

      data.push({ x, y, z, speed: 8.5 + Math.random() * 4.0, originY, len });

      const idx = i * 6;
      positions[idx] = x;
      positions[idx + 1] = y;
      positions[idx + 2] = z;

      positions[idx + 3] = x;
      positions[idx + 4] = y + len; // 垂直水帘短线
      positions[idx + 5] = z;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return { eavesLineGeo: geo, eavesData: data };
  }, [eavesDripCount]);

  // 3. 落水涟漪扩散环
  const rippleCount = 160;
  const { rippleGeo, rippleData } = useMemo(() => {
    const geo = new THREE.RingGeometry(0.02, 0.07, 18);
    geo.rotateX(-Math.PI / 2);

    const data: { x: number; z: number; scale: number; maxScale: number; speed: number }[] = [];
    for (let i = 0; i < rippleCount; i++) {
      data.push({
        x: (Math.random() - 0.5) * 38,
        z: (Math.random() - 0.5) * 38,
        scale: Math.random() * 0.8,
        maxScale: 0.7 + Math.random() * 0.7,
        speed: 1.0 + Math.random() * 0.7,
      });
    }

    return { rippleGeo: geo, rippleData: data };
  }, [rippleCount]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  // 帧动画循环
  useFrame((_, delta) => {
    let speedMult = 1.0 * rainIntensity;
    let slantX = -0.16;

    if (rainType === 'light') {
      speedMult = 0.65 * rainIntensity;
      slantX = -0.10;
    } else if (rainType === 'moderate') {
      speedMult = 1.0 * rainIntensity;
      slantX = -0.16;
    } else if (rainType === 'heavy') {
      speedMult = 1.35 * rainIntensity;
      slantX = -0.22;
    } else if (rainType === 'storm') {
      speedMult = 1.8 * rainIntensity;
      slantX = -0.32;
    }

    // A. 更新雨丝倾泻
    if (rainLinesRef.current) {
      const positions = rainLinesRef.current.geometry.attributes.position.array as Float32Array;

      for (let i = 0; i < rainStreakCount; i++) {
        const item = rainData[i];
        item.y -= item.speed * delta * speedMult;
        item.x += slantX * item.speed * delta * speedMult;

        const localX = Math.abs(item.x - PAVILION_POS[0]);
        const localZ = Math.abs(item.z - PAVILION_POS[2]);
        const radius = Math.max(localX, localZ) / 4.15;
        const corner = Math.max(localX, localZ) > 0
          ? Math.min(localX, localZ) / Math.max(localX, localZ) : 0;
        const roofY = 3.6 + 1.9 * Math.pow(Math.max(0, 1 - radius), 1.45)
          + Math.pow(radius, 5) * (0.07 + 0.2 * Math.pow(corner, 6));
        if (item.y < 0.05 || (radius <= 1 && item.y < roofY + 0.03)) {
          item.y = 22 + Math.random() * 3;
          item.x = (Math.random() - 0.5) * 45;
          item.z = (Math.random() - 0.5) * 45;
        }

        const idx = i * 6;
        positions[idx] = item.x;
        positions[idx + 1] = item.y;
        positions[idx + 2] = item.z;

        positions[idx + 3] = item.x - slantX * item.length;
        positions[idx + 4] = item.y + item.length;
        positions[idx + 5] = item.z;
      }
      rainLinesRef.current.geometry.attributes.position.needsUpdate = true;
    }

    // B. 更新屋檐滴水 (纯流线细短线段更新)
    if (eavesLinesRef.current) {
      const eavesPos = eavesLinesRef.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < eavesDripCount; i++) {
        const drop = eavesData[i];
        drop.y -= drop.speed * delta * speedMult;
        if (drop.y < 0.1) {
          drop.y = drop.originY;
        }

        const idx = i * 6;
        eavesPos[idx] = drop.x;
        eavesPos[idx + 1] = drop.y;
        eavesPos[idx + 2] = drop.z;

        eavesPos[idx + 3] = drop.x;
        eavesPos[idx + 4] = drop.y + drop.len;
        eavesPos[idx + 5] = drop.z;
      }
      eavesLinesRef.current.geometry.attributes.position.needsUpdate = true;
    }

    // C. 更新落水涟漪
    if (rippleMeshRef.current) {
      rippleData.forEach((r, i) => {
        r.scale += r.speed * delta * speedMult;
        if (r.scale > r.maxScale) {
          r.scale = 0.02;
          r.x = (Math.random() - 0.5) * 38;
          r.z = (Math.random() - 0.5) * 38;
        }

        dummy.position.set(r.x, getTerrainHeight(r.x, r.z) + 0.02, r.z);
        const sheltered = Math.abs(r.x - PAVILION_POS[0]) < 4.15
          && Math.abs(r.z - PAVILION_POS[2]) < 4.15;
        const scale = sheltered ? 0 : r.scale;
        dummy.scale.set(scale, 1, scale);
        dummy.updateMatrix();
        rippleMeshRef.current!.setMatrixAt(i, dummy.matrix);
      });
      rippleMeshRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* 1. 真实全景倾斜细雨丝 (流线型 LineSegments，无方块) */}
      <lineSegments ref={rainLinesRef} geometry={lineGeo}>
        <lineBasicMaterial
          color="#dbebe3"
          transparent
          opacity={
            rainType === 'light'
              ? 0.35
              : rainType === 'moderate'
              ? 0.52
              : rainType === 'heavy'
              ? 0.68
              : 0.82
          }
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>

      {/* 2. 屋檐垂直滴水帘 (纯细短水丝，绝无白方块) */}
      <lineSegments ref={eavesLinesRef} geometry={eavesLineGeo}>
        <lineBasicMaterial
          color="#e8f8f0"
          transparent
          opacity={0.65}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>

      {/* 3. 动态落水涟漪 */}
      <instancedMesh
        ref={rippleMeshRef}
        args={[rippleGeo, undefined, rippleCount]}
      >
        <meshBasicMaterial
          color="#9ec4b5"
          transparent
          opacity={0.35}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </instancedMesh>
    </group>
  );
};
