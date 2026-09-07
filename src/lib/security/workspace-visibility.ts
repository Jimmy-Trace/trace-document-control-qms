export type WorkspaceVisibility = {
  controlledSubmission: boolean;
  approvalOperations: boolean;
  lifecycleOperations: boolean;
  acknowledgments: boolean;
  acknowledgmentDistribution: boolean;
  controlledCopies: boolean;
  membershipAdministration: boolean;
  folderManager: boolean;
  retentionAdministration: boolean;
  recordManagement: boolean;
  recordCreate: boolean;
  recordArchive: boolean;
  recordTypeAdministration: boolean;
};

export function workspaceVisibility(permissionKeys: Iterable<string>): WorkspaceVisibility {
  const permissions = new Set(permissionKeys);
  const has = (key: string) => permissions.has(key);
  return {
    controlledSubmission: has("document.submit") && has("document.review.manage"),
    approvalOperations: has("document.approve"),
    lifecycleOperations:
      has("document.make_effective") || has("document.retire") || has("document.revise"),
    acknowledgments: has("document.acknowledge"),
    acknowledgmentDistribution: has("document.distribute"),
    controlledCopies: has("document.distribute"),
    membershipAdministration: has("administration.manage"),
    folderManager: has("document.read"),
    retentionAdministration: has("administration.manage"),
    recordManagement: has("record.read"),
    recordCreate: has("record.create"),
    recordArchive: has("record.archive"),
    recordTypeAdministration: has("administration.manage"),
  };
}
