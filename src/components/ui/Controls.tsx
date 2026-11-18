import React from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { CameraViewType, WeatherType } from '../../types';
import {
  Volume2,
  VolumeX,
  Compass,
  Music,
  CloudRain,
  Sun,
  Moon,
  CloudDrizzle,
  Move3d,
  Sliders,
} from 'lucide-react';
import { soundEngine } from '../../utils/audioSynthesizer';

const CAMERAS: { type: CameraViewType; label: string; icon?: React.ReactNode }[] = [
  { type: 'pavilion', label: '亭内听雨' },
  { type: 'stream', label: '临溪观澜' },
  { type: 'bamboo', label: '幽篁深径' },
  { type: 'overview', label: '山林鸟瞰' },
  { type: 'free', label: '自由漫游', icon: <Move3d size={13} /> },
];

const WEATHERS: { type: WeatherType; label: string; icon: React.ReactNode }[] = [
  { type: 'light', label: '微雨', icon: <CloudDrizzle size={14} /> },
  { type: 'moderate', label: '细雨', icon: <CloudRain size={14} /> },
  { type: 'dusk', label: '暮雨', icon: <Sun size={14} /> },
  { type: 'night', label: '夜雨', icon: <Moon size={14} /> },
];

export const Controls: React.FC = () => {
  const cameraView = useAppStore((state) => state.cameraView);
  const setCameraView = useAppStore((state) => state.setCameraView);
  const weather = useAppStore((state) => state.weather);
  const setWeather = useAppStore((state) => state.setWeather);
  const isAudioPlaying = useAppStore((state) => state.isAudioPlaying);
  const toggleAudio = useAppStore((state) => state.toggleAudio);
  const isAutoRotate = useAppStore((state) => state.isAutoRotate);
  const toggleAutoRotate = useAppStore((state) => state.toggleAutoRotate);
  const isSettingsOpen = useAppStore((state) => state.isSettingsOpen);
  const toggleSettings = useAppStore((state) => state.toggleSettings);

  return (
    <>
      {/* 1. 顶部标题与沉浸音效开关 */}
      <div className="fixed top-6 right-6 z-20 flex items-center gap-3">
        {/* 自动全景旋转 */}
        <button
          onClick={toggleAutoRotate}
          className={`glass-panel px-3.5 py-2 rounded-full text-xs flex items-center gap-1.5 transition-all ${
            isAutoRotate ? 'text-emerald-400 border-emerald-500/40 bg-emerald-950/40' : 'text-stone-300'
          }`}
          title="自动缓动环绕视点"
        >
          <Compass size={14} className={isAutoRotate ? 'animate-spin' : ''} />
          <span>漫游环视</span>
        </button>

        {/* 抚琴按钮 */}
        <button
          onClick={() => soundEngine.playGuqinString()}
          className="glass-panel px-3.5 py-2 rounded-full text-xs text-stone-300 hover:text-emerald-300 flex items-center gap-1.5 transition-all"
          title="拨动案头古琴琴弦"
        >
          <Music size={14} />
          <span>抚琴</span>
        </button>

        {/* 沉浸式立体环境雨声开关 */}
        <button
          onClick={toggleAudio}
          className={`glass-panel px-4 py-2 rounded-full text-xs flex items-center gap-2 font-medium transition-all ${
            isAudioPlaying
              ? 'text-emerald-300 border-emerald-500/50 bg-emerald-950/40 shadow-lg shadow-emerald-950/40'
              : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          {isAudioPlaying ? (
            <>
              <Volume2 size={16} className="text-emerald-400 animate-pulse" />
              <span>雨声潺潺</span>
            </>
          ) : (
            <>
              <VolumeX size={16} />
              <span>开启静心雨声</span>
            </>
          )}
        </button>

        {/* 境象调控面板按钮 */}
        <button
          onClick={toggleSettings}
          className={`glass-panel px-3.5 py-2 rounded-full text-xs flex items-center gap-1.5 transition-all ${
            isSettingsOpen
              ? 'text-emerald-300 border-emerald-500/50 bg-emerald-950/40 shadow-lg shadow-emerald-950/40'
              : 'text-stone-300 hover:text-white'
          }`}
          title="打开境象调控面板 (调节缩放速度、光影与风雨)"
        >
          <Sliders size={14} className={isSettingsOpen ? 'text-emerald-400' : ''} />
          <span>调控</span>
        </button>
      </div>

      {/* 2. 底部中央主控制台：机位切换与天气变换 */}
      <div className="fixed bottom-5 inset-x-0 z-20 flex flex-col items-center justify-center gap-2 px-4 pointer-events-none">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* 机位选择 */}
          <div className="glass-panel p-1.5 rounded-full flex items-center gap-1 pointer-events-auto shadow-2xl">
            {CAMERAS.map((cam) => {
              const active = cameraView === cam.type;
              return (
                <button
                  key={cam.type}
                  onClick={() => setCameraView(cam.type)}
                  className={`px-3.5 py-1.5 rounded-full text-xs transition-all font-serif flex items-center gap-1.5 ${
                    active
                      ? 'bg-emerald-900/70 text-emerald-200 border border-emerald-500/40 shadow'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  {cam.icon}
                  <span>{cam.label}</span>
                </button>
              );
            })}
          </div>

          {/* 天气时令调节 */}
          <div className="glass-panel p-1.5 rounded-full flex items-center gap-1 pointer-events-auto shadow-2xl">
            {WEATHERS.map((w) => {
              const active = weather === w.type;
              return (
                <button
                  key={w.type}
                  onClick={() => setWeather(w.type)}
                  className={`px-3 py-1.5 rounded-full text-xs flex items-center gap-1.5 transition-all ${
                    active
                      ? 'bg-stone-800 text-emerald-300 border border-stone-600/50'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                  title={w.label}
                >
                  {w.icon}
                  <span>{w.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 自由操作引导小贴士 */}
        <div className="text-[11px] text-stone-400/70 tracking-wider flex items-center gap-2">
          <span>左键拖动 360° 旋转</span>
          <span>·</span>
          <span>滚轮缩放</span>
          <span>·</span>
          <span>右键拖动或 WASD / 方向键漫游走动</span>
        </div>
      </div>
    </>
  );
};
