import * as THREE from 'three';
import { getStreamCenterX, getStreamHalfWidth, PAVILION_POS } from './terrain';

export const BAMBOO_COUNT = 580;

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export type BambooInstance = {
  x: number;
  z: number;
  scaleY: number;
  scaleXZ: number;
  rotation: number;
  lean: number;
  shade: THREE.Color;
};

/**
 * 听雨亭林间来宾主土路中心线函数 (与 ForestGround.tsx 渲染的泥土小径 100% 吻合)
 */
export function getPathCenterX(z: number): number {
  return PAVILION_POS[0] + Math.sin((z - 4.4) * 0.19) * 1.2;
}

/**
 * 计算特定坐标期望的竹子生长间距 (Density Field)
 * 严格保护规则：
 * 1. 亭台内部与石阶绝对净空：半径 clearance 范围内绝对禁止任何竹子穿入室内！
 * 2. 亭子正前方迎客大门与入亭前坪：绝对畅通开阔，绝不挡亭门！
 * 3. 林间迎宾主小路通廊：小路路面及两侧留出足额安全距离，路面 0 阻挡！
 * 4. 亲水下溪石阶踏步：留出开阔缓坡！
 */
function getDesiredSpacing(
  x: number,
  z: number,
  clearance = 4.8,
  densityScale = 1.0
): number {
  const dx = x - PAVILION_POS[0];
  const dz = z - PAVILION_POS[2];
  const distPavilion = Math.hypot(dx, dz);

  // 1. 听雨亭主体与基座绝对净空区 (默认 4.8m 范围，彻底杜绝竹子穿入地板、触碰屋檐或遮挡案几)
  if (distPavilion < clearance) return -1;

  // 2. 亭子正前门入口前坪与入亭门廊 (从亭前 z=0.5 到 z=6.5，x 在 0.5 ~ 3.9 的宽大前坪，彻底净空！)
  if (dz > 0 && dz < 6.2 && Math.abs(dx) < 2.3) return -1;

  // 3. 林间泥土迎宾小径全线大净空通廊 (保证整条小路宽达 4.6 米的视觉走廊完全畅通！)
  if (z > 3.0) {
    const pathX = getPathCenterX(z);
    if (Math.abs(x - pathX) < 2.3) return -1;
  }

  // 4. 亭前下溪踏步亲水石阶净空区
  const sx = -2.4;
  const sz = 1.2;
  const t = Math.max(0, Math.min(1, (dx * sx + dz * sz) / (sx * sx + sz * sz)));
  const distSteps = Math.hypot(dx - t * sx, dz - t * sz);
  if (distSteps < 1.6 && distPavilion < 6.8) return -1;

  // 5. 清溪流水主河床避让
  const streamCenterX = getStreamCenterX(z);
  if (Math.abs(x - streamCenterX) < getStreamHalfWidth(z, x < streamCenterX ? -1 : 1) + 0.35) return -1;

  // 6. 密度场：
  let spacing = 1.15 * densityScale;
  if (distPavilion < clearance + 2.5) {
    spacing = 1.25 * densityScale;
  }
  if (Math.abs(x - streamCenterX) < 4.5) {
    spacing = Math.max(spacing, 1.4 * densityScale);
  }

  return spacing;
}

/**
 * 变半径泊松圆盘采样（Poisson Disk Sampling）
 * 支持用户动态调节：
 * - targetCount: 竹子总数 (例如 200 ~ 850)
 * - clearance: 亭周避让半径 (例如 3.5m ~ 6.5m)
 * - densityScale: 竹海间距疏密倍率 (例如 0.7 ~ 1.8)
 */
export function createBambooLayout(
  targetCount = BAMBOO_COUNT,
  clearance = 4.8,
  densityScale = 1.0
): BambooInstance[][] {
  const random = seededRandom(92813);
  const batches: BambooInstance[][] = [[], [], [], []];

  const minSpacing = 0.95 * densityScale;
  const cellSize = minSpacing / Math.SQRT2;
  const minX = -35;
  const maxX = 35;
  const minZ = -35;
  const maxZ = 35;

  const cols = Math.ceil((maxX - minX) / cellSize);
  const rows = Math.ceil((maxZ - minZ) / cellSize);
  const grid = new Int32Array(cols * rows).fill(-1);

  const sampledPoints: { x: number; z: number; spacing: number }[] = [];
  const activeQueue: number[] = [];

  // ================= 阶段 1：在亭周安全带 (clearance + 0.3m ~ clearance + 1.6m) 播种修竹 =================
  const pavilionSeedCount = 20;
  for (let i = 0; i < pavilionSeedCount; i++) {
    const angle = (i * Math.PI * 2) / pavilionSeedCount;
    const r = clearance + 0.35 + (i % 3) * 0.45;
    const sx = PAVILION_POS[0] + Math.cos(angle) * r;
    const sz = PAVILION_POS[2] + Math.sin(angle) * r;
    const sp = getDesiredSpacing(sx, sz, clearance, densityScale);
    if (sp > 0) {
      const pIdx = sampledPoints.length;
      sampledPoints.push({ x: sx, z: sz, spacing: sp });
      activeQueue.push(pIdx);
      const c = Math.floor((sx - minX) / cellSize);
      const row = Math.floor((sz - minZ) / cellSize);
      if (row >= 0 && row < rows && c >= 0 && c < cols) {
        grid[row * cols + c] = pIdx;
      }
    }
  }

  // ================= 阶段 2：在全景背景山林播种扩展种子点 =================
  for (let i = 0; i < 24; i++) {
    const sx = minX + random() * (maxX - minX);
    const sz = minZ + random() * (maxZ - minZ);
    const sp = getDesiredSpacing(sx, sz, clearance, densityScale);
    if (sp > 0) {
      const pIdx = sampledPoints.length;
      sampledPoints.push({ x: sx, z: sz, spacing: sp });
      activeQueue.push(pIdx);
      const c = Math.floor((sx - minX) / cellSize);
      const row = Math.floor((sz - minZ) / cellSize);
      if (row >= 0 && row < rows && c >= 0 && c < cols) {
        grid[row * cols + c] = pIdx;
      }
    }
  }

  // ================= 阶段 3：泊松圆盘生长 =================
  while (activeQueue.length > 0 && sampledPoints.length < targetCount + 50) {
    const qIdx = Math.floor(random() * activeQueue.length);
    const centerIdx = activeQueue[qIdx];
    const center = sampledPoints[centerIdx];
    let spawned = false;

    for (let attempt = 0; attempt < 28; attempt++) {
      const angle = random() * Math.PI * 2;
      const dist = center.spacing * (1.02 + random() * 0.75);
      const nx = center.x + Math.cos(angle) * dist;
      const nz = center.z + Math.sin(angle) * dist;

      if (nx < minX || nx > maxX || nz < minZ || nz > maxZ) continue;

      const nSpacing = getDesiredSpacing(nx, nz, clearance, densityScale);
      if (nSpacing <= 0) continue;

      const col = Math.floor((nx - minX) / cellSize);
      const row = Math.floor((nz - minZ) / cellSize);
      if (col < 0 || col >= cols || row < 0 || row >= rows) continue;

      const searchRadius = Math.ceil(nSpacing / cellSize);
      const rStart = Math.max(0, row - searchRadius);
      const rEnd = Math.min(rows - 1, row + searchRadius);
      const cStart = Math.max(0, col - searchRadius);
      const cEnd = Math.min(cols - 1, col + searchRadius);

      let conflict = false;
      for (let r = rStart; r <= rEnd && !conflict; r++) {
        for (let c = cStart; c <= cEnd; c++) {
          const neighborIdx = grid[r * cols + c];
          if (neighborIdx !== -1) {
            const neighbor = sampledPoints[neighborIdx];
            const d = Math.hypot(nx - neighbor.x, nz - neighbor.z);
            const req = Math.min(nSpacing, neighbor.spacing) * 0.94;
            if (d < req) {
              conflict = true;
              break;
            }
          }
        }
      }

      if (!conflict) {
        const newIdx = sampledPoints.length;
        sampledPoints.push({ x: nx, z: nz, spacing: nSpacing });
        activeQueue.push(newIdx);
        grid[row * cols + col] = newIdx;
        spawned = true;
        break;
      }
    }

    if (!spawned) {
      activeQueue.splice(qIdx, 1);
    }
  }

  // ================= 阶段 4：姿态与参数设定 =================
  for (let i = 0; i < sampledPoints.length && i < targetCount; i++) {
    const pt = sampledPoints[i];
    const distPav = Math.hypot(pt.x - PAVILION_POS[0], pt.z - PAVILION_POS[2]);
    const streamCenterX = getStreamCenterX(pt.z);
    const distStream = Math.abs(pt.x - streamCenterX);

    let lean = (random() - 0.5) * 0.05;
    let rotation = random() * Math.PI * 2;

    if (distPav < clearance + 1.8) {
      // 亭外修竹向外微展
      const awayAngle = Math.atan2(pt.z - PAVILION_POS[2], pt.x - PAVILION_POS[0]);
      lean = 0.035 + random() * 0.03;
      rotation = awayAngle + (random() - 0.5) * 0.3;
    } else if (distStream < 4.2) {
      // 溪畔竹向水微躬
      const toStreamSign = pt.x > streamCenterX ? -1 : 1;
      lean = toStreamSign * (0.04 + random() * 0.04);
      rotation = (pt.x > streamCenterX ? Math.PI : 0) + (random() - 0.5) * 0.4;
    }

    const maturity = Math.min(1, Math.max(0.72, pt.spacing < 1.3 ? 1.05 : 0.88 + random() * 0.2));
    const scaleY = (0.8 + random() * 0.38) * maturity;
    const scaleXZ = (0.78 + random() * 0.3) * maturity;

    const hue = 0.182 + (random() - 0.5) * 0.025;
    const sat = 0.09 + random() * 0.11;
    const light = 0.82 + random() * 0.14;
    const shade = new THREE.Color().setHSL(hue, sat, light);

    const variant = Math.floor(random() * 4);
    batches[variant].push({
      x: pt.x,
      z: pt.z,
      scaleY,
      scaleXZ,
      rotation,
      lean,
      shade,
    });
  }

  return batches;
}
