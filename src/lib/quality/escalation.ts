export function escalationLevel(overdueDays: number): 1 | 2 | 3 | null {
  if (!Number.isFinite(overdueDays) || overdueDays < 1) return null;
  if (overdueDays >= 30) return 3;
  if (overdueDays >= 7) return 2;
  return 1;
}
