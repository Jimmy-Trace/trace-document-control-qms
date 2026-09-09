import { describe, expect, it } from "vitest";
import type { ValidationProjectStatusReference } from "./qms-reference";

describe("external validation project reference boundary", () => {
  it("keeps the payload lifecycle-metadata only", () => {
    const record: ValidationProjectStatusReference = {
      validationProjectId: "00000000-0000-0000-0000-000000000001",
      projectNumber: "VAL-001",
      laboratoryMethodId: "00000000-0000-0000-0000-000000000002",
      laboratoryMethodVersionId: "00000000-0000-0000-0000-000000000003",
      status: "IN_PROGRESS",
      startedAt: new Date("2026-09-01T00:00:00Z"),
      completedAt: null,
    };

    expect(Object.keys(record).sort()).toEqual([
      "completedAt",
      "laboratoryMethodId",
      "laboratoryMethodVersionId",
      "projectNumber",
      "startedAt",
      "status",
      "validationProjectId",
    ]);
  });
});
