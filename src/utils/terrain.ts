/**
 * 真实自然山林与溪谷地貌高度函数 (Terrain Elevation System)
 * 1. 远离核心区山丘缓坡起伏
 * 2. 听雨木亭建立在岸上干燥微高台 (高爽石台地，绝不在水中)
 * 3. 小溪位于亭子前侧偏左 (x ≈ -5.0)，下切成自然河谷
 */
export const TERRAIN_SIZE = 85;
export const STREAM_CHANNEL_HALF_WIDTH = 2.8;
export const STREAM_SURFACE_HALF_WIDTH = STREAM_CHANNEL_HALF_WIDTH + 0.2;
export const STREAM_WATER_LEVEL = -0.06;

export const PAVILION_POS: [number, number, number] = [2.2, 0, 0.5];

export function getStreamCenterX(z: number): number {
  return Math.sin(z * 0.2) * 2.4 - 5.0;
}

export function getTerrainHeight(x: number, z: number): number {
  // A. 小溪中心线位置：位于亭子左前方山谷中 (中心线 x ≈ -5.0)
  const streamCenterX = getStreamCenterX(z);
  const distToStream = Math.abs(x - streamCenterX);

  // B. 听雨亭核心台地：中心在 (2.2, 0.5)，宽台基，中心周围约 5.2 米范围保持平整
  const distToPavilion = Math.hypot(x - PAVILION_POS[0], z - PAVILION_POS[2]);

  // C. 基础山林地形：多频柔和山峦缓坡起伏
  const distFromCenter = Math.hypot(x, z);
  const outerRise = Math.pow(Math.min(distFromCenter / 36, 1), 1.8) * 3.2;

  const hillWaves =
    Math.sin(x * 0.12 + z * 0.08) * 0.6 +
    Math.cos(x * 0.06 - z * 0.14) * 0.5 +
    Math.sin(x * 0.25 + z * 0.2) * 0.16;

  let height = outerRise + hillWaves;

  // D. 听雨亭陆上高爽干燥台地 (微抬 0.15 米，保证稳固居于岸上)
  if (distToPavilion < 7.2) {
    const t = Math.max(0, Math.min((distToPavilion - 5.2) / 2, 1));
    const smoothT = t * t * (3 - 2 * t);
    height = height * smoothT + 0.15 * (1 - smoothT);
  }

  // E. 溪谷河床自然下切下沉 (河床中心下凹 -0.38 米)
  if (distToStream < STREAM_CHANNEL_HALF_WIDTH) {
    const riverT = distToStream / STREAM_CHANNEL_HALF_WIDTH;
    const riverBed = -0.38 + Math.pow(riverT, 2) * 0.38;
    const blend = riverT * riverT * (3 - 2 * riverT);
    height = height * blend + riverBed * (1 - blend);
  }

  return height;
}
