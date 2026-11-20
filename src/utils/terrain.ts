/**
 * 真实自然山林与溪谷地貌高度函数 (Terrain Elevation System)
 * 1. 远离核心区山丘缓坡起伏
 * 2. 听雨木亭建立在岸上干燥微高台 (高爽石台地，绝不在水中)
 * 3. 小溪位于亭子前侧偏左 (x ≈ -5.0)，下切成自然河谷
 */
export const TERRAIN_SIZE = 85;
export const STREAM_CHANNEL_HALF_WIDTH = 4.8;
export const STREAM_SURFACE_HALF_WIDTH = STREAM_CHANNEL_HALF_WIDTH + 0.2;
export const STREAM_WATER_LEVEL = -0.06;

export const PAVILION_POS: [number, number, number] = [2.2, 0, 0.5];

export function getStreamCenterX(z: number): number {
  return Math.sin(z * 0.2) * 2.4 - 5.0;
}

const smooth = (a: number, b: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
// Asymmetric banks leave room for a broader pool on the side away from the
// pavilion. The right bank stays outside the stone foundation and stair.
export function getStreamHalfWidth(z: number, side: number): number {
  const pool = Math.exp(-Math.pow((z - 1.5) / 5.5, 2));
  const riffle = Math.exp(-Math.pow((z + 7) / 2.8, 2));
  const base = 3.15 + Math.sin(z * 0.27 + 0.6) * 0.24 + Math.sin(z * 0.63) * 0.12 - riffle * 0.35;
  if (side < 0) return Math.min(STREAM_CHANNEL_HALF_WIDTH, base + 0.40 + pool * 0.95);
  const width = base + pool * 0.35;
  const protect = smooth(-8, -3.8, z) * (1 - smooth(4.8, 9, z));
  const safeWidth = Math.min(width, Math.max(0.9, -1.75 - getStreamCenterX(z)));
  return width * (1 - protect) + safeWidth * protect;
}
export function getStreamFlowFactor(z: number): number {
  const width = getStreamHalfWidth(z, -1) + getStreamHalfWidth(z, 1);
  return Math.max(0.72, Math.min(1.45, 6.8 / width));
}

function getBaseTerrainHeight(x: number, z: number): number {
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

  // A rounded, broad bed with a deeper pavilion pool and shallow riffles.
  const halfWidth = getStreamHalfWidth(z, x < streamCenterX ? -1 : 1);
  const shoulder = 1 - smooth(1, 1.5, distToStream / halfWidth);
  height += Math.max(0, 0.055 - height) * shoulder;
  if (distToStream < halfWidth) {
    const riverT = distToStream / halfWidth;
    const pool = Math.exp(-Math.pow((z - 1.5) / 5.5, 2));
    const riffle = Math.exp(-Math.pow((z + 7) / 2.8, 2));
    const riverBed = -0.58 - pool * 0.25 + riffle * 0.12 + Math.sin(z * 0.52) * 0.045 + riverT * riverT * 0.12;
    const blend = smooth(0.38, 1, riverT);
    height = height * blend + riverBed * (1 - blend);
  }

  return height;
}


export interface GroundPuddle {
  x: number; z: number; radiusX: number; radiusZ: number; level: number; depth: number;
}
// Small depressions on dry ground only; creek water and the pavilion platform
// keep their own elevations. Water surfaces share these exact basin levels.
export const GROUND_PUDDLES: GroundPuddle[] = [
  [3.8, 6.1, 0.58, 0.30], [1.9, 8.7, 0.46, 0.28], [4.9, 12.6, 0.55, 0.32],
  [-0.2, 6.4, 0.42, 0.25], [7.0, 7.3, 0.60, 0.31], [9.6, 10.4, 0.55, 0.30],
  [5.7, 4.9, 0.40, 0.24], [-10.8, -1.5, 0.50, 0.30],
].flatMap(([x, z, radiusX, radiusZ]) => {
  const center = getStreamCenterX(z);
  if (Math.abs(x-center) < getStreamHalfWidth(z,x<center?-1:1)+0.4) return [];
  const ground = getBaseTerrainHeight(x,z);
  if (ground < 0.08) return [];
  const heights = Array.from({length:8},(_,i)=>getBaseTerrainHeight(
    x+Math.cos(i*Math.PI/4)*radiusX,z+Math.sin(i*Math.PI/4)*radiusZ));
  if (Math.max(...heights)-Math.min(...heights)>0.14) return [];
  return [{x,z,radiusX,radiusZ,level:ground-0.010,depth:0.016}];
});

export function getTerrainHeight(x: number, z: number): number {
  let height = getBaseTerrainHeight(x,z);
  for (const p of GROUND_PUDDLES) {
    if (Math.abs(x-p.x)>p.radiusX*1.6 || Math.abs(z-p.z)>p.radiusZ*1.6) continue;
    const radius=Math.hypot((x-p.x)/p.radiusX,(z-p.z)/p.radiusZ);
    if (radius>=1.6) continue;
    const floor=p.level-p.depth*(1-Math.min(1,radius*radius)*0.25);
    const rim=Math.max(height,p.level+0.006);
    const edge=smooth(0.55,1.15,radius);
    const basin=floor*(1-edge)+rim*edge;
    const outside=smooth(1.15,1.6,radius);
    height=basin*(1-outside)+height*outside;
  }
  return height;
}
