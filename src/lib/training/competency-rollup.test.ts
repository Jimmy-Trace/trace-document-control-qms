import { describe, expect, it } from "vitest";
import { competencyDashboard, competencyRollups } from "./competency-rollup";

const base = { employeeId: "e1", programId: "p1", assessedAt: "2026-09-01T12:00:00.000Z" };

describe("competency rollups", () => {
  it("uses only the latest assessment per employee and program", () => {
    const rollups = competencyRollups([
      { id: "old", ...base, assessedAt: "2026-08-01T12:00:00.000Z", outcome: "NOT_QUALIFIED", expiresAt: null },
      { id: "new", ...base, outcome: "QUALIFIED", expiresAt: "2027-01-01" },
    ], "2026-09-07");
    expect(rollups).toHaveLength(1);
    expect(rollups[0]?.id).toBe("new");
    expect(rollups[0]?.status).toBe("CURRENT");
  });

  it("derives due-soon and expired status without mutating assessment history", () => {
    expect(competencyRollups([{ id: "due", ...base, outcome: "QUALIFIED", expiresAt: "2026-09-30" }], "2026-09-07")[0]?.status).toBe("DUE_SOON");
    expect(competencyRollups([{ id: "expired", ...base, outcome: "QUALIFIED", expiresAt: "2026-09-01" }], "2026-09-07")[0]?.status).toBe("EXPIRED");
  });

  it("summarizes operational status counts", () => {
    const rollups = competencyRollups([
      { id: "a", ...base, employeeId: "e1", outcome: "QUALIFIED", expiresAt: "2027-01-01" },
      { id: "b", ...base, employeeId: "e2", outcome: "NOT_QUALIFIED", expiresAt: null },
      { id: "c", ...base, employeeId: "e3", outcome: "CONDITIONAL", expiresAt: null },
    ], "2026-09-07");
    expect(competencyDashboard(rollups)).toEqual({ total: 3, current: 1, dueSoon: 0, expired: 0, notQualified: 1, conditional: 1 });
  });
});
