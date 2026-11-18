import React, { useRef, Suspense } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { soundEngine } from '../../utils/audioSynthesizer';
import { PAVILION_POS } from '../../utils/terrain';
import { ProceduralPavilion } from './ProceduralPavilion';

export const Pavilion: React.FC = () => {
  const candleLightRef = useRef<THREE.PointLight>(null);
  const candleFlameRef = useRef<THREE.Group>(null);

  // 烛火微风轻颤与呼吸摇曳
  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    if (candleLightRef.current) {
      // 细腻自然的古风微风烛火微闪
      const flicker =
        Math.sin(time * 5.8) * 0.12 +
        Math.sin(time * 14.2) * 0.07 +
        (Math.sin(time * 29.3) > 0.6 ? 0.06 : -0.04);
      candleLightRef.current.intensity = 1.35 + flicker;
    }
    if (candleFlameRef.current) {
      candleFlameRef.current.scale.y = 1.0 + Math.sin(time * 8.5) * 0.12;
      candleFlameRef.current.rotation.z = Math.sin(time * 4.2) * 0.05;
    }
  });

  // 点击抚琴
  const handlePlayGuqin = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    soundEngine.playGuqinString();
  };

  return (
    <group position={PAVILION_POS}>
      {/* 1. 宽敞的单层四角听雨亭，灰瓦与石地板 */}
      <Suspense fallback={null}>
        <ProceduralPavilion />
      </Suspense>

      {/* 2. 亭中央雅致陈设：木几、古琴、茶盏、香炉、宋式防风烛台 */}
      <group position={[0, 0.41, -0.6]}>
        <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.6, 0.08, 0.55]} />
          <meshStandardMaterial color="#2a1810" roughness={0.5} />
        </mesh>
        <mesh position={[-0.65, 0.16, 0]}>
          <boxGeometry args={[0.08, 0.32, 0.45]} />
          <meshStandardMaterial color="#2a1810" roughness={0.5} />
        </mesh>
        <mesh position={[0.65, 0.16, 0]}>
          <boxGeometry args={[0.08, 0.32, 0.45]} />
          <meshStandardMaterial color="#2a1810" roughness={0.5} />
        </mesh>

        {/* 古琴 (可点击弹奏) */}
        <group
          position={[0, 0.41, 0.02]}
          onClick={handlePlayGuqin}
          onPointerOver={() => (document.body.style.cursor = 'pointer')}
          onPointerOut={() => (document.body.style.cursor = 'default')}
        >
          <mesh castShadow>
            <boxGeometry args={[1.15, 0.035, 0.22]} />
            <meshStandardMaterial color="#1a0f0a" roughness={0.3} metalness={0.2} />
          </mesh>
          <mesh position={[0, 0.02, 0]}>
            <boxGeometry args={[1.05, 0.003, 0.12]} />
            <meshStandardMaterial color="#e6d4b5" roughness={0.2} emissive="#3d3323" />
          </mesh>
        </group>

        {/* 青花瓷茶盏 */}
        <mesh position={[-0.55, 0.43, -0.1]} castShadow>
          <cylinderGeometry args={[0.04, 0.025, 0.05, 12]} />
          <meshStandardMaterial color="#e8f0eb" roughness={0.2} />
        </mesh>

        {/* 宣德青铜小香炉 */}
        <group position={[0.55, 0.42, -0.08]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.06, 0.045, 0.07, 16]} />
            <meshStandardMaterial color="#4a3e2a" metalness={0.6} roughness={0.4} />
          </mesh>
        </group>

        {/* 方案一：宋式青铜案头防风烛台 (宋代文人雅室烛照，典雅沉静) */}
        <group position={[-0.42, 0.39, 0.1]}>
          {/* 青铜承盘底座 */}
          <mesh castShadow>
            <cylinderGeometry args={[0.07, 0.08, 0.015, 24]} />
            <meshStandardMaterial color="#3d3326" roughness={0.38} metalness={0.7} />
          </mesh>
          <mesh position={[0, 0.018, 0]}>
            <cylinderGeometry args={[0.038, 0.045, 0.02, 20]} />
            <meshStandardMaterial color="#3d3326" roughness={0.38} metalness={0.7} />
          </mesh>
          {/* 青铜修长立柱与竹节饰环 */}
          <mesh position={[0, 0.09, 0]}>
            <cylinderGeometry args={[0.011, 0.014, 0.14, 16]} />
            <meshStandardMaterial color="#3d3326" roughness={0.38} metalness={0.7} />
          </mesh>
          <mesh position={[0, 0.09, 0]}>
            <torusGeometry args={[0.016, 0.004, 8, 16]} />
            <meshStandardMaterial color="#4a3e2e" roughness={0.35} metalness={0.75} />
          </mesh>
          {/* 托盏承烛盘 */}
          <mesh position={[0, 0.165, 0]}>
            <cylinderGeometry args={[0.045, 0.022, 0.02, 20]} />
            <meshStandardMaterial color="#3d3326" roughness={0.38} metalness={0.7} />
          </mesh>
          {/* 天然白蜂蜡烛柱 */}
          <mesh position={[0, 0.21, 0]}>
            <cylinderGeometry args={[0.013, 0.013, 0.07, 16]} />
            <meshStandardMaterial color="#f7f3e8" roughness={0.55} />
          </mesh>
          {/* 烛芯与跳跃烛火 */}
          <group ref={candleFlameRef} position={[0, 0.25, 0]}>
            {/* 烛芯 */}
            <mesh position={[0, 0.005, 0]}>
              <cylinderGeometry args={[0.0018, 0.0018, 0.012, 6]} />
              <meshBasicMaterial color="#1a1a1a" />
            </mesh>
            {/* 暖金外焰 */}
            <mesh position={[0, 0.022, 0]}>
              <coneGeometry args={[0.012, 0.036, 12]} />
              <meshBasicMaterial color="#ff9e3b" />
            </mesh>
            {/* 明亮内焰芯 */}
            <mesh position={[0, 0.018, 0]}>
              <coneGeometry args={[0.006, 0.02, 10]} />
              <meshBasicMaterial color="#fff4d0" />
            </mesh>
          </group>
          {/* 半透微光琉璃/丝绢防风罩 (山间听雨防风必备) */}
          <mesh position={[0, 0.265, 0]}>
            <cylinderGeometry args={[0.046, 0.042, 0.19, 24, 1, true]} />
            <meshStandardMaterial
              color="#fff6e5"
              transparent
              opacity={0.32}
              roughness={0.2}
              side={THREE.DoubleSide}
            />
          </mesh>
          {/* 防风罩青铜包边 */}
          <mesh position={[0, 0.36, 0]}>
            <torusGeometry args={[0.046, 0.0028, 8, 24]} />
            <meshStandardMaterial color="#3d3326" roughness={0.4} metalness={0.7} />
          </mesh>
          <mesh position={[0, 0.17, 0]}>
            <torusGeometry args={[0.042, 0.0028, 8, 24]} />
            <meshStandardMaterial color="#3d3326" roughness={0.4} metalness={0.7} />
          </mesh>
          {/* 案头微光烛火主光源 */}
          <pointLight
            ref={candleLightRef}
            position={[0, 0.27, 0]}
            color="#ff9d42"
            intensity={1.35}
            distance={4.5}
            decay={2}
          />
        </group>
      </group>

      {/* 3. 亭内极微弱柔和漫反射 (保证夜雨中古亭梁柱隐约可见，绝不刺眼) */}
      <pointLight position={[0, 2.2, -0.4]} color="#ffd299" intensity={0.35} distance={5} decay={2} />
    </group>
  );
};
