import { create } from 'zustand';
import type { RainType } from '../types';

export type AssetStatus = 'loading' | 'decoding' | 'ready' | 'error';
export interface LoadingAsset { status: AssetStatus; error?: string }
export const RAIN_AUDIO_SOURCES: Record<RainType, string | null> = {
  light: '/audio/rain.mp3', moderate: '/audio/moderate-rain.mp3',
  heavy: null, storm: null, thunder: '/audio/thunder.mp3',
};
export const rainAudioKey = (rain: RainType) => RAIN_AUDIO_SOURCES[rain] ?? 'synthetic-rain';

interface LoadingState {
  textures: Record<string, LoadingAsset>;
  audio: Record<string, LoadingAsset>;
  sceneReady: boolean;
  sceneError: string | null;
  setTexture: (url: string, status: AssetStatus, error?: string) => void;
  setAudio: (url: string, status: AssetStatus, error?: string) => void;
  setSceneReady: (ready: boolean) => void;
  setSceneError: (error: string | null) => void;
}
export const useLoadingStore = create<LoadingState>(set => ({
  textures: {}, audio: {}, sceneReady: false, sceneError: null,
  setTexture: (url, status, error) => set(state => ({ textures: { ...state.textures, [url]: { status, error } } })),
  setAudio: (url, status, error) => set(state => ({ audio: { ...state.audio, [url]: { status, error } } })),
  setSceneReady: sceneReady => set({ sceneReady }),
  setSceneError: sceneError => set({ sceneError }),
}));
