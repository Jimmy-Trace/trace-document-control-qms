import { describe, expect, it } from "vitest";
import { workspaceVisibility } from "./workspace-visibility";

describe("workspace visibility", () => {
  it("keeps read-only users on document browsing without management surfaces", () => {
    expect(workspaceVisibility(["document.read"])).toEqual({
      controlledSubmission: false,
      approvalOperations: false,
      lifecycleOperations: false,
      acknowledgments: false,
      acknowledgmentDistribution: false,
      controlledCopies: false,
      membershipAdministration: false,
      folderManager: true,
      retentionAdministration: false,
    });
  });

  it("shows recipient acknowledgment work without distribution authority", () => {
    const visibility = workspaceVisibility(["document.read", "document.acknowledge"]);
    expect(visibility.acknowledgments).toBe(true);
    expect(visibility.acknowledgmentDistribution).toBe(false);
    expect(visibility.controlledCopies).toBe(false);
  });

  it("shows controlled-copy operations only with document distribution authority", () => {
    expect(workspaceVisibility(["document.read"]).controlledCopies).toBe(false);
    expect(workspaceVisibility(["document.distribute"]).controlledCopies).toBe(true);
  });

  it("requires both submit and review-management authority for controlled submission", () => {
    expect(workspaceVisibility(["document.submit"]).controlledSubmission).toBe(false);
    expect(workspaceVisibility(["document.submit", "document.review.manage"]).controlledSubmission).toBe(true);
  });

  it("shows administrative surfaces only to administration managers", () => {
    const visibility = workspaceVisibility(["administration.manage"]);
    expect(visibility.membershipAdministration).toBe(true);
    expect(visibility.retentionAdministration).toBe(true);
  });
});
