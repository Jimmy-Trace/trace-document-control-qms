export type DashboardVisibility = {
  documents: boolean;
  reviewQueue: boolean;
  administration: boolean;
  createDocument: boolean;
  deliveryFailures: boolean;
};

export function dashboardVisibility(capabilities: {
  canReadDocuments: boolean;
  canCreateDocuments: boolean;
  canManageReviews: boolean;
  canManageNotifications: boolean;
  canManageAccess: boolean;
}): DashboardVisibility {
  return {
    documents: capabilities.canReadDocuments,
    reviewQueue: capabilities.canManageReviews,
    administration:
      capabilities.canManageAccess ||
      capabilities.canManageReviews ||
      capabilities.canManageNotifications,
    createDocument: capabilities.canCreateDocuments,
    deliveryFailures: capabilities.canManageNotifications,
  };
}
