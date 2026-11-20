import { RAIN_WATER_PRESETS, MAX_WATER_IMPACT_DENSITY, clampWaterSetting, type RainWaterSettings } from './rainWaterPresets';
import type { RainType } from '../types';
import { getStreamCenterX, getTerrainHeight, STREAM_WATER_LEVEL } from './terrain';

export interface StreamConditions {
  rainImpact: number;
  rainCoverage: number;
  flowSpeed: number;
  waveHeight: number;
  turbidity: number;
  levelRise: number;
  foam: number;
}
export interface StreamDynamics extends StreamConditions, RainWaterSettings {
  time: number;
  distance: number;
}
const PROFILES: Record<Exclude<RainType, 'thunder'>, StreamConditions> = {
  light: { rainImpact: 0.22, rainCoverage: 0.24, flowSpeed: 0.32, waveHeight: 0.007, turbidity: 0.04, levelRise: 0, foam: 0.045 },
  moderate: { rainImpact: 0.44, rainCoverage: 0.48, flowSpeed: 0.48, waveHeight: 0.010, turbidity: 0.15, levelRise: 0.006, foam: 0.09 },
  heavy: { rainImpact: 0.72, rainCoverage: 0.73, flowSpeed: 0.72, waveHeight: 0.014, turbidity: 0.34, levelRise: 0.015, foam: 0.17 },
  storm: { rainImpact: 1, rainCoverage: 0.94, flowSpeed: 0.98, waveHeight: 0.018, turbidity: 0.58, levelRise: 0.024, foam: 0.28 },
};
const clamp = (value: number, lo: number, hi: number) => Math.max(lo, Math.min(value, hi));
export function getStreamConditions(rain: RainType, intensity = 1): StreamConditions {
  // Thunder describes lightning; it does not add a stronger hydrological tier.
  const base = PROFILES[rain === 'thunder' ? 'storm' : rain];
  const strength = clamp(intensity, 0.3, 2);
  return {
    rainImpact: clamp(base.rainImpact * strength, 0.05, 1.3),
    rainCoverage: clamp(base.rainCoverage * Math.sqrt(strength), 0.1, 0.98),
    flowSpeed: base.flowSpeed * (0.75 + strength * 0.25),
    waveHeight: Math.min(0.022, base.waveHeight * (0.75 + strength * 0.25)),
    turbidity: Math.min(0.72, base.turbidity * (0.75 + strength * 0.25)),
    // The stream banks are shallow. Keep the rise below their lowest crest.
    levelRise: Math.min(0.024, base.levelRise * strength),
    foam: Math.min(0.36, base.foam * strength),
  };
}
export function createStreamDynamics(rain: RainType, intensity = 1, water = RAIN_WATER_PRESETS[rain]): StreamDynamics {
  return { ...getStreamConditions(rain, intensity), ...water, time: 0, distance: 0 };
}
export function advanceStream(state: StreamDynamics, target: StreamConditions & RainWaterSettings, delta: number) {
  // Limit a resumed tab's first step; exponential damping is frame-rate independent.
  const dt = clamp(delta, 0, 0.1);
  const approach = (key: keyof StreamConditions, riseSeconds: number, fallSeconds = riseSeconds) => {
    const duration = target[key] > state[key] ? riseSeconds : fallSeconds;
    state[key] += (target[key] - state[key]) * (1 - Math.exp(-dt / duration));
  };
  state.waterImpactStrength += (clampWaterSetting(target.waterImpactStrength, 2) - state.waterImpactStrength) * (1 - Math.exp(-dt / 0.6));
  state.waterImpactDensity += (clampWaterSetting(target.waterImpactDensity, MAX_WATER_IMPACT_DENSITY) - state.waterImpactDensity) * (1 - Math.exp(-dt / 0.6));
  approach('rainImpact', 0.9); approach('rainCoverage', 1.2);
  approach('flowSpeed', 9, 17); approach('waveHeight', 3, 6);
  approach('turbidity', 20, 45); approach('levelRise', 28, 55); approach('foam', 8, 16);
  state.time += dt;
  state.distance += state.flowSpeed * dt;
}
function smoothstep(a: number, b: number, x: number) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}
export const STREAM_WAVES = [
  { z: 2.2, x: 0, weight: 0.65 },
  { z: 3.4, x: 4.2, weight: 0.25 },
  { z: 5.5, x: -2.1, weight: 0.10 },
] as const;
export function getStreamSurfaceHeight(x: number, z: number, state: StreamDynamics) {
  const level = STREAM_WATER_LEVEL + state.levelRise;
  const shore = smoothstep(0.012, 0.12, level - getTerrainHeight(x, z));
  const across = x - getStreamCenterX(z);
  const wave = STREAM_WAVES.reduce((sum, w) => sum + Math.sin((z - state.distance) * w.z + across * w.x) * w.weight, 0);
  return level + wave * state.waveHeight * shore;
}
// The water, wakes, floating leaves and boat share the exact same wave field.
export const STREAM_WAVE_GLSL = `
  float streamWave(vec2 p, float depth, float travel, float height) {
    float across=p.x-(sin(p.y*0.2)*2.4-5.0);
    float wave=${STREAM_WAVES.map(w => `sin((p.y-travel)*${w.z.toFixed(1)}+across*${w.x.toFixed(1)})*${w.weight.toFixed(2)}`).join('+')};
    return wave*height*smoothstep(0.012,0.12,depth);
  }
`;
