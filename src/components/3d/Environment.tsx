import React from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { ForestGround } from './ForestGround';

export const Environment: React.FC = () => {
  const weather = useAppStore((state) => state.weather);
  const fogDensityParam = useAppStore((state) => state.config.fogDensity);
  const lightBrightness = useAppStore((state) => state.config.lightBrightness);

  // 清朗、明亮、富有意境的国风烟雨环境配色
  const config = {
    // 微雨：明亮天青、薄烟如织、江南早春水墨感
    light: {
      fogColor: '#9bb8ad',
      fogDensity: 0.02,
      ambientColor: '#bdd4cb',
      ambientIntensity: 1.3,
      hemiSky: '#e8f4ee',
      hemiGround: '#4b6356',
      hemiIntensity: 1.0,
      dirColor: '#f0f9f4',
      dirIntensity: 1.4,
      dirPos: [12, 18, 10] as [number, number, number],
      groundColor: '#365243',
    },
    // 细雨：潇潇春雨、天光通透、翠竹青润
    moderate: {
      fogColor: '#8ba69c',
      fogDensity: 0.024,
      ambientColor: '#a8c2b7',
      ambientIntensity: 1.2,
      hemiSky: '#dbebe2',
      hemiGround: '#3d5448',
      hemiIntensity: 0.9,
      dirColor: '#e0eee6',
      dirIntensity: 1.2,
      dirPos: [10, 16, 8] as [number, number, number],
      groundColor: '#2f473b',
    },
    // 暮雨：夕阳微熹穿透雨帘、暖金与青绿交融
    dusk: {
      fogColor: '#b39f8a',
      fogDensity: 0.022,
      ambientColor: '#d6bfa8',
      ambientIntensity: 1.2,
      hemiSky: '#fae8d4',
      hemiGround: '#524336',
      hemiIntensity: 1.0,
      dirColor: '#f7b87c',
      dirIntensity: 1.5,
      dirPos: [-14, 10, 10] as [number, number, number],
      groundColor: '#453c35',
    },
    // 夜雨：空山新雨、朗月当空、清冷出尘而非死黑
    night: {
      fogColor: '#2b3f3b',
      fogDensity: 0.028,
      ambientColor: '#4d6962',
      ambientIntensity: 0.8,
      hemiSky: '#5f8078',
      hemiGround: '#1c2e29',
      hemiIntensity: 0.6,
      dirColor: '#8abfb3', // 清澈月华
      dirIntensity: 0.9,
      dirPos: [-8, 15, -10] as [number, number, number],
      groundColor: '#1d2e26',
    },
  }[weather];

  return (
    <>
      {/* 1. 意境烟雨薄雾 (降低浓度，保持明亮与视野通透) */}
      <fogExp2 attach="fog" args={[config.fogColor, fogDensityParam]} />

      {/* 2. 背景清透天色 */}
      <color attach="background" args={[config.fogColor]} />

      {/* 3. 半球漫反射天光 (让天空与地面形成自然上下反差，竹林立体通透) */}
      <hemisphereLight
        args={[config.hemiSky, config.hemiGround, config.hemiIntensity * (lightBrightness / 1.2)]}
      />

      {/* 4. 整体柔和环境光 */}
      <ambientLight color={config.ambientColor} intensity={config.ambientIntensity * (lightBrightness / 1.2)} />

      {/* 5. 主漫射方向光 (斜射投影，让亭子和竹竿更有光影体积感) */}
      <directionalLight
        color={config.dirColor}
        intensity={config.dirIntensity * (lightBrightness / 1.2)}
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

      <ForestGround />
    </>
  );
};
