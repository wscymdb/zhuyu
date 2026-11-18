import { create } from 'zustand';
import { WeatherType, CameraViewType, PoemItem } from '../types';
import { soundEngine } from '../utils/audioSynthesizer';

export const POEMS: PoemItem[] = [
  {
    title: '竹里馆',
    author: '王维',
    dynasty: '唐',
    lines: ['独坐幽篁里', '弹琴复长啸', '深林人不知', '明月来相照']
  },
  {
    title: '兰亭集序（节选）',
    author: '王羲之',
    dynasty: '晋',
    lines: ['此地有崇山峻岭', '茂林修竹', '又有清流激湍', '映带左右']
  },
  {
    title: '定风波（节选）',
    author: '苏轼',
    dynasty: '宋',
    lines: ['莫听穿林打叶声', '何妨吟啸且徐行', '竹杖芒鞋轻胜马', '一蓑烟雨任平生']
  },
  {
    title: '听雨',
    author: '虞集',
    dynasty: '元',
    lines: ['行尽江南数十程', '晓风残月入华清', '朝元阁上青山好', '淅淅疏雨竹窗声']
  }
];

export interface AppConfig {
  zoomSpeed: number;        // 缩放速度 (0.1 ~ 1.5, 默认 0.4)
  rotateSpeed: number;      // 旋转速度 (0.2 ~ 1.5, 默认 0.7)
  moveSpeed: number;        // 漫游移动速度 (1 ~ 12, 默认 5.0)
  rainIntensity: number;    // 雨水强度 (0.3 ~ 2.0, 默认 1.0)
  windSpeed: number;        // 竹林风速 (0.2 ~ 2.5, 默认 1.0)
  fogDensity: number;       // 烟雨雾气浓度 (0.005 ~ 0.05, 默认 0.022)
  lightBrightness: number;  // 环境天光亮度 (0.5 ~ 2.5, 默认 1.2)
  bambooCount: number;      // 竹子总株数 (150 ~ 850, 默认 580)
  bambooClearance: number;  // 亭台避让净空 (3.5 ~ 6.5米, 默认 4.8米)
  bambooDensity: number;    // 竹海间距疏密倍率 (0.7 ~ 1.8, 默认 1.0)
}

const DEFAULT_CONFIG: AppConfig = {
  zoomSpeed: 0.4,
  rotateSpeed: 0.7,
  moveSpeed: 5.0,
  rainIntensity: 1.0,
  windSpeed: 1.0,
  fogDensity: 0.022,
  lightBrightness: 1.2,
  bambooCount: 580,
  bambooClearance: 4.8,
  bambooDensity: 1.0,
};

interface AppState {
  weather: WeatherType;
  cameraView: CameraViewType;
  isAudioPlaying: boolean;
  isAutoRotate: boolean;
  volume: number;
  currentPoemIndex: number;
  showPoem: boolean;
  isSettingsOpen: boolean;

  // 配置项
  config: AppConfig;
  
  setWeather: (weather: WeatherType) => void;
  setCameraView: (view: CameraViewType) => void;
  toggleAudio: () => void;
  toggleAutoRotate: () => void;
  setVolume: (v: number) => void;
  nextPoem: () => void;
  togglePoem: () => void;
  toggleSettings: () => void;
  setConfig: <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => void;
  resetConfig: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  weather: 'moderate',
  cameraView: 'pavilion',
  isAudioPlaying: false,
  isAutoRotate: false,
  volume: 0.7,
  currentPoemIndex: 0,
  showPoem: true,
  isSettingsOpen: false,

  config: { ...DEFAULT_CONFIG },

  setWeather: (weather) => {
    set({ weather });
    soundEngine.setWeatherIntensity(weather);
  },

  setCameraView: (cameraView) => {
    set({ cameraView });
    soundEngine.setInPavilion(cameraView === 'pavilion');
  },

  toggleAudio: () => {
    const isCurrentlyPlaying = get().isAudioPlaying;
    if (isCurrentlyPlaying) {
      soundEngine.stopAmbience();
      set({ isAudioPlaying: false });
    } else {
      soundEngine.startAmbience();
      soundEngine.setInPavilion(get().cameraView === 'pavilion');
      soundEngine.setWeatherIntensity(get().weather);
      set({ isAudioPlaying: true });
    }
  },

  toggleAutoRotate: () => {
    set((state) => ({ isAutoRotate: !state.isAutoRotate }));
  },

  setVolume: (volume) => {
    set({ volume });
    soundEngine.setMasterVolume(volume);
  },

  nextPoem: () => {
    set((state) => ({
      currentPoemIndex: (state.currentPoemIndex + 1) % POEMS.length
    }));
  },

  togglePoem: () => {
    set((state) => ({ showPoem: !state.showPoem }));
  },

  toggleSettings: () => {
    set((state) => ({ isSettingsOpen: !state.isSettingsOpen }));
  },

  setConfig: (key, value) => {
    set((state) => ({
      config: {
        ...state.config,
        [key]: value,
      },
    }));
  },

  resetConfig: () => {
    set({ config: { ...DEFAULT_CONFIG } });
  },
}));
