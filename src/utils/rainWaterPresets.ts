import type { RainType } from '../types';

export interface RainWaterSettings {
  waterImpactStrength: number;
  waterImpactDensity: number;
}
export const MAX_WATER_IMPACT_DENSITY = 6;
export const RAIN_WATER_PRESETS: Record<RainType, RainWaterSettings> = {
  light: { waterImpactStrength: 0.35, waterImpactDensity: 0.35 },
  moderate: { waterImpactStrength: 0.65, waterImpactDensity: 0.70 },
  heavy: { waterImpactStrength: 1.00, waterImpactDensity: 1.20 },
  storm: { waterImpactStrength: 1.70, waterImpactDensity: 4.50 },
  thunder: { waterImpactStrength: 1.70, waterImpactDensity: 4.50 },
};
export const WATER_SETTINGS_STORAGE_KEY = 'zhuyu-rain-water-presets-v1';
export function clampWaterSetting(value: number, maximum: number) {
  return Number.isFinite(value) ? Math.max(0, Math.min(maximum, value)) : 0;
}
export function readRainWaterPresets(): Record<RainType, RainWaterSettings> {
  const presets = structuredClone(RAIN_WATER_PRESETS);
  try {
    const stored = JSON.parse(localStorage.getItem(WATER_SETTINGS_STORAGE_KEY) || '{}');
    for (const rain of Object.keys(presets) as RainType[]) {
      const item = stored?.[rain];
      // Upgrade unchanged legacy storm defaults; retain explicitly tuned presets.
      if ((rain === 'storm' || rain === 'thunder') && item?.waterImpactStrength === 1.7 && item?.waterImpactDensity === 2.1) continue;
      if (Number.isFinite(item?.waterImpactStrength) && Number.isFinite(item?.waterImpactDensity)) {
        presets[rain] = { waterImpactStrength: clampWaterSetting(item.waterImpactStrength, 2),
          waterImpactDensity: clampWaterSetting(item.waterImpactDensity, MAX_WATER_IMPACT_DENSITY) };
      }
    }
  } catch { /* Storage can be unavailable; built-in presets still work. */ }
  return presets;
}
export function saveRainWaterPresets(presets: Record<RainType, RainWaterSettings>) {
  try { localStorage.setItem(WATER_SETTINGS_STORAGE_KEY, JSON.stringify(presets)); } catch { /* In-memory controls remain usable. */ }
}
