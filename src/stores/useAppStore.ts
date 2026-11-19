import { create } from 'zustand';
import { RainType, TimeOfDayType, WeatherType, CameraViewType, PoemItem } from '../types';
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
  rainIntensity: number;    // 雨水强度倍率 (0.3 ~ 2.0, 默认 1.0)
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
  // 雨势与时序
  rainType: RainType;
  timeOfDay: TimeOfDayType;
  timeHour: number; // 0 ~ 24

  // 动物叫声与音量
  animalSound: string;
  animalVolume: number; // 0.0 ~ 1.0

  // 兼容旧属性
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
  
  setRainType: (rainType: RainType) => void;
  setTimeOfDay: (timeOfDay: TimeOfDayType) => void;
  setTimeHour: (hour: number) => void;
  setAnimalSound: (sound: string) => void;
  setAnimalVolume: (volume: number) => void;
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
  rainType: 'light',
  timeOfDay: 'day',
  timeHour: 12,
  animalSound: 'cuckoo',
  animalVolume: 0.45,
  weather: 'light',

  cameraView: 'pavilion',
  isAudioPlaying: false,
  isAutoRotate: false,
  volume: 0.85,
  currentPoemIndex: 0,
  showPoem: true,
  isSettingsOpen: false,

  config: { ...DEFAULT_CONFIG },

  setRainType: (rainType: RainType) => {
    set({ rainType, weather: rainType });
    soundEngine.setRainType(rainType);
  },

  setAnimalSound: (animalSound: string) => {
    set({ animalSound });
    soundEngine.setAnimalSound(animalSound);
  },

  setAnimalVolume: (animalVolume: number) => {
    set({ animalVolume });
    soundEngine.setAnimalVolume(animalVolume);
  },

  setTimeOfDay: (timeOfDay: TimeOfDayType) => {
    const hours: Record<TimeOfDayType, number> = {
      dawn: 6,
      day: 12,
      dusk: 18.5,
      night: 23,
    };
    set({ timeOfDay, timeHour: hours[timeOfDay] ?? 12 });
  },

  setTimeHour: (hour: number) => {
    let tod: TimeOfDayType = 'day';
    if (hour >= 5 && hour < 8.5) {
      tod = 'dawn';
    } else if (hour >= 8.5 && hour < 17) {
      tod = 'day';
    } else if (hour >= 17 && hour < 20) {
      tod = 'dusk';
    } else {
      tod = 'night';
    }
    set({ timeHour: hour, timeOfDay: tod });
  },

  setWeather: (weather) => {
    get().setRainType(weather as RainType);
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
      soundEngine.setRainType(get().rainType);
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
