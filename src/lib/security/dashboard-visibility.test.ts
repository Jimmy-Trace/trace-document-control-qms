import { describe, expect, it } from "vitest";
import { dashboardVisibility } from "./dashboard-visibility";

const none = {
  canReadDocuments: false,
  canCreateDocuments: false,
  canManageReviews: false,
  canManageNotifications: false,
  canManageAccess: false,
};

describe("dashboard visibility", () => {
  it("keeps read-only users out of review and administration navigation", () => {
    expect(dashboardVisibility({ ...none, canReadDocuments: true })).toEqual({
      documents: true,
      reviewQueue: false,
      administration: false,
      createDocument: false,
      deliveryFailures: false,
    });
  });

  it("shows administration for each legitimate management capability", () => {
    expect(dashboardVisibility({ ...none, canManageAccess: true }).administration).toBe(true);
    expect(dashboardVisibility({ ...none, canManageReviews: true }).administration).toBe(true);
    expect(dashboardVisibility({ ...none, canManageNotifications: true }).administration).toBe(true);
  });

  it("does not expose delivery-failure metrics without notification management", () => {
    expect(dashboardVisibility({ ...none, canReadDocuments: true }).deliveryFailures).toBe(false);
    expect(dashboardVisibility({ ...none, canManageNotifications: true }).deliveryFailures).toBe(true);
  });
});
