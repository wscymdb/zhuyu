import React, { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useAppStore } from '../../stores/useAppStore';
import { ForestGround } from './ForestGround';
import { soundEngine } from '../../utils/audioSynthesizer';

// 递归生成国风写意 3D 分支闪电电弧线段
function generateLightningBolt(startX: number, startZ: number): THREE.BufferGeometry {
  const points: number[] = [];

  function addBranch(
    x1: number,
    y1: number,
    z1: number,
    x2: number,
    y2: number,
    z2: number,
    depth: number
  ) {
    if (depth <= 0) {
      points.push(x1, y1, z1, x2, y2, z2);
      return;
    }
    const midX = (x1 + x2) / 2 + (Math.random() - 0.5) * 2.2 * depth;
    const midY = (y1 + y2) / 2 + (Math.random() - 0.5) * 1.1;
    const midZ = (z1 + z2) / 2 + (Math.random() - 0.5) * 2.2 * depth;

    addBranch(x1, y1, z1, midX, midY, midZ, depth - 1);
    addBranch(midX, midY, midZ, x2, y2, z2, depth - 1);

    // 随机延伸次生侧向分叉电弧
    if (depth >= 2 && Math.random() > 0.45) {
      const branchEndX = midX + (Math.random() - 0.5) * 6.5;
      const branchEndY = midY - (2.5 + Math.random() * 4.5);
      const branchEndZ = midZ + (Math.random() - 0.5) * 6.5;
      addBranch(midX, midY, midZ, branchEndX, branchEndY, branchEndZ, depth - 2);
    }
  }

  const endX = startX + (Math.random() - 0.5) * 12;
  const endZ = startZ + (Math.random() - 0.5) * 8;
  addBranch(startX, 35, startZ, endX, 6, endZ, 4);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  return geo;
}

export const Environment: React.FC = () => {
  const { scene } = useThree();
  const timeOfDay = useAppStore((state) => state.timeOfDay);
  const rainType = useAppStore((state) => state.rainType);
  const fogDensityParam = useAppStore((state) => state.config.fogDensity);
  const lightBrightness = useAppStore((state) => state.config.lightBrightness);

  // 闪电与惊雷视觉驱动引用
  const lightningIntensityRef = useRef(0);
  const boltMeshRef = useRef<THREE.LineSegments>(null);
  const boltMatRef = useRef<THREE.LineBasicMaterial>(null);
  const lightningDirRef = useRef<THREE.DirectionalLight>(null);
  const lightningPointRef = useRef<THREE.PointLight>(null);

  // 初始空电弧几何体
  const initialBoltGeo = useMemo(() => generateLightningBolt(0, -32), []);

  // 监听 Web Audio 的精准波形爆发点闪电回调
  useEffect(() => {
    soundEngine.onLightning = (intensity: number) => {
      lightningIntensityRef.current = Math.max(lightningIntensityRef.current, intensity);

      // 主电弧爆发时重新生成形态各异的远山电弧
      if (intensity >= 0.6) {
        const startX = (Math.random() - 0.5) * 40;
        const startZ = -22 - Math.random() * 18;
        const newGeo = generateLightningBolt(startX, startZ);
        if (boltMeshRef.current) {
          boltMeshRef.current.geometry.dispose();
          boltMeshRef.current.geometry = newGeo;
        }
      }
    };
    return () => {
      soundEngine.onLightning = null;
    };
  }, []);

  // 清朗、明亮、富有意境的国风时辰天光配色
  const timeConfigs = {
    // 晨曦：破晓微光、早霞初映、薄烟如织
    dawn: {
      fogColor: '#96aba1',
      ambientColor: '#b4c7bf',
      ambientIntensity: 1.25,
      hemiSky: '#e4eee8',
      hemiGround: '#43594e',
      hemiIntensity: 1.0,
      dirColor: '#fce2cc',
      dirIntensity: 1.35,
      dirPos: [15, 12, 10] as [number, number, number],
      groundColor: '#344e40',
    },
    // 白昼：潇潇烟雨、天光通透、翠竹青润
    day: {
      fogColor: '#8ba69c',
      ambientColor: '#a8c2b7',
      ambientIntensity: 1.3,
      hemiSky: '#dbebe2',
      hemiGround: '#3d5448',
      hemiIntensity: 1.05,
      dirColor: '#eef7f2',
      dirIntensity: 1.45,
      dirPos: [10, 18, 8] as [number, number, number],
      groundColor: '#2f473b',
    },
    // 暮色：夕阳微熹穿透雨帘、暖金与晚霞交融
    dusk: {
      fogColor: '#b59e88',
      ambientColor: '#d5bea6',
      ambientIntensity: 1.25,
      hemiSky: '#fae6d2',
      hemiGround: '#524235',
      hemiIntensity: 1.0,
      dirColor: '#f7ad74',
      dirIntensity: 1.55,
      dirPos: [-14, 10, 10] as [number, number, number],
      groundColor: '#453c35',
    },
    // 子夜：空山新雨、朗月当空、清冷出尘而非死黑
    night: {
      fogColor: '#253733',
      ambientColor: '#425e57',
      ambientIntensity: 0.85,
      hemiSky: '#54756e',
      hemiGround: '#182723',
      hemiIntensity: 0.65,
      dirColor: '#82baa9', // 清澈月华
      dirIntensity: 0.95,
      dirPos: [-8, 16, -10] as [number, number, number],
      groundColor: '#1d2e26',
    },
  };

  const baseConfig = timeConfigs[timeOfDay] || timeConfigs.day;

  // 暴雨与雷雨天候：云雾低垂、沉雄压迫
  const isThunder = rainType === 'thunder';
  const stormFogMult = isThunder ? 1.45 : rainType === 'storm' ? 1.25 : 1.0;
  const stormLightMult = isThunder ? 0.65 : rainType === 'storm' ? 0.82 : 1.0;

  // 基础雾色与电光闪烁雾色缓存
  const baseColor = useMemo(
    () => (isThunder ? new THREE.Color('#1c2a27') : new THREE.Color(baseConfig.fogColor)),
    [isThunder, baseConfig.fogColor]
  );
  const flashFogColor = useMemo(() => new THREE.Color('#9ec6df'), []);
  const currentFogColor = useMemo(() => new THREE.Color(), []);

  // 帧循环实时驱动闪电爆发衰减与全场景高亮
  useFrame((_, delta) => {
    if (lightningIntensityRef.current > 0.001) {
      // 指数级自然衰减 (模拟真实闪电骤亮与余晖渐隐)
      lightningIntensityRef.current = Math.max(0, lightningIntensityRef.current - delta * 3.4);
    }
    const flash = lightningIntensityRef.current;

    // 1. 动态瞬态定向闪电光束
    if (lightningDirRef.current) {
      lightningDirRef.current.intensity = flash * 12.0;
    }

    // 2. 动态山顶高空散射天光点光源
    if (lightningPointRef.current) {
      lightningPointRef.current.intensity = flash * 8.5;
    }

    // 3. 动态枝桠闪电电弧透明度
    if (boltMatRef.current) {
      boltMatRef.current.opacity = Math.min(1.0, flash * 1.6);
      boltMatRef.current.visible = flash > 0.04;
    }

    // 4. 天空与雾气暴闪联动
    if (scene.fog && scene.fog instanceof THREE.FogExp2) {
      currentFogColor.lerpColors(baseColor, flashFogColor, flash * 0.85);
      scene.fog.color.copy(currentFogColor);
      if (scene.background instanceof THREE.Color) {
        scene.background.copy(currentFogColor);
      }
    }
  });

  return (
    <>
      {/* 1. 意境烟雨薄雾 */}
      <fogExp2 attach="fog" args={[baseColor.getStyle(), fogDensityParam * stormFogMult]} />

      {/* 2. 背景清透天色 */}
      <color attach="background" args={[baseColor.getStyle()]} />

      {/* 3. 半球漫反射天光 */}
      <hemisphereLight
        args={[
          baseConfig.hemiSky,
          baseConfig.hemiGround,
          baseConfig.hemiIntensity * (lightBrightness / 1.2) * stormLightMult,
        ]}
      />

      {/* 4. 整体柔和环境光 */}
      <ambientLight
        color={baseConfig.ambientColor}
        intensity={baseConfig.ambientIntensity * (lightBrightness / 1.2) * stormLightMult}
      />

      {/* 5. 主漫射方向光 */}
      <directionalLight
        color={baseConfig.dirColor}
        intensity={baseConfig.dirIntensity * (lightBrightness / 1.2) * stormLightMult}
        position={baseConfig.dirPos}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.5}
        shadow-camera-far={45}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-bias={-0.0005}
      />

      {/* 6. 【雷雨特效】真实闪电定向强光源 */}
      <directionalLight
        ref={lightningDirRef}
        color="#edf5ff"
        intensity={0}
        position={[12, 30, -10]}
      />

      {/* 7. 【雷雨特效】真实高空云层泛光点光源 */}
      <pointLight
        ref={lightningPointRef}
        color="#c8e4ff"
        intensity={0}
        distance={95}
        position={[0, 26, -5]}
      />

      {/* 8. 【雷雨特效】远山真实分支电弧电光 (动态生成，若隐若现) */}
      <lineSegments ref={boltMeshRef} geometry={initialBoltGeo}>
        <lineBasicMaterial
          ref={boltMatRef}
          color="#ffffff"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>

      {/* 9. 高精度 PBR 湿地地表 */}
      <ForestGround />
    </>
  );
};
