// 雨势等级：小雨 (轻柔/细雨.mp3)、中雨 (潇潇细雨)、大雨 (密雨倾盆)、暴雨 (狂风骤雨)、雷雨 (电闪雷鸣)
export type RainType = 'light' | 'moderate' | 'heavy' | 'storm' | 'thunder';

// 时辰天光：晨曦 (破晓)、白昼 (天青)、暮色 (霞光)、子夜 (月华)
export type TimeOfDayType = 'dawn' | 'day' | 'dusk' | 'night';

// 动物生灵叫声：布谷鸟 (cuckoo)、静音 (none)，预留后续扩展 (cicada, cricket, frog 等)
export type AnimalSoundType = 'cuckoo' | 'none' | string;

// 兼容别名
export type WeatherType = RainType;

export type CameraViewType = 'pavilion' | 'stream' | 'bamboo' | 'overview' | 'free';

export interface PoemItem {
  title: string;
  author: string;
  dynasty: string;
  lines: string[];
}
