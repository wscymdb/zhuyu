export type BambooDetail = 0 | 1 | 2;
// A two-metre hysteresis band prevents repeated LOD switches while roaming.
export function bambooDetailAtDistance(distance: number, previous = -1): BambooDetail {
  if (previous === 0 && distance <= 14) return 0;
  if (previous === 1 && distance >= 10 && distance <= 26) return 1;
  if (previous === 2 && distance >= 22) return 2;
  return distance < 12 ? 0 : distance < 24 ? 1 : 2;
}
