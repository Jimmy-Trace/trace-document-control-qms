export function escalationLevels(overdueDays: number): Array<1 | 2 | 3> {
  if (!Number.isFinite(overdueDays) || overdueDays < 1) return [];
  const levels: Array<1 | 2 | 3> = [1];
  if (overdueDays >= 7) levels.push(2);
  if (overdueDays >= 30) levels.push(3);
  return levels;
}
