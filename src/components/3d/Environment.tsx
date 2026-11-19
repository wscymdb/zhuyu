import React from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { ForestGround } from './ForestGround';

export const Environment: React.FC = () => {
  const timeOfDay = useAppStore((state) => state.timeOfDay);
  const rainType = useAppStore((state) => state.rainType);
  const fogDensityParam = useAppStore((state) => state.config.fogDensity);
  const lightBrightness = useAppStore((state) => state.config.lightBrightness);

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

  const config = timeConfigs[timeOfDay] || timeConfigs.day;

  // 暴雨天候略微加深云雾压迫感
  const stormFogMult = rainType === 'storm' ? 1.25 : 1.0;
  const stormLightMult = rainType === 'storm' ? 0.82 : 1.0;

  return (
    <>
      {/* 1. 意境烟雨薄雾 (降低浓度，保持明亮与视野通透) */}
      <fogExp2 attach="fog" args={[config.fogColor, fogDensityParam * stormFogMult]} />

      {/* 2. 背景清透天色 */}
      <color attach="background" args={[config.fogColor]} />

      {/* 3. 半球漫反射天光 (让天空与地面形成自然上下反差，竹林立体通透) */}
      <hemisphereLight
        args={[
          config.hemiSky,
          config.hemiGround,
          config.hemiIntensity * (lightBrightness / 1.2) * stormLightMult,
        ]}
      />

      {/* 4. 整体柔和环境光 */}
      <ambientLight
        color={config.ambientColor}
        intensity={config.ambientIntensity * (lightBrightness / 1.2) * stormLightMult}
      />

      {/* 5. 主漫射方向光 (斜射投影，让亭子和竹竿更有光影体积感) */}
      <directionalLight
        color={config.dirColor}
        intensity={config.dirIntensity * (lightBrightness / 1.2) * stormLightMult}
        position={config.dirPos}
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

      {/* 6. 高精度 PBR 湿地地表 */}
      <ForestGround />
    </>
  );
};
