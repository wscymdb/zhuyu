export type WeatherType = 'light' | 'moderate' | 'dusk' | 'night';

export type CameraViewType = 'pavilion' | 'stream' | 'bamboo' | 'overview' | 'free';

export interface PoemItem {
  title: string;
  author: string;
  dynasty: string;
  lines: string[];
}
