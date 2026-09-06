import {
  requireAuthorization,
  type AuthorizationContext,
} from "../security/authorization";

export type ApprovalAssignmentOption = {
  id: string;
  name: string;
};
export type ApprovalAssignmentTask = {
  id: string;
  documentVersionId: string;
  documentNumber: string;
  title: string;
  revisionLabel: string;
  assigneeUserId: string | null;
};
export interface ApprovalAssignmentStore {
  list(organizationId: string): Promise<{
    tasks: ApprovalAssignmentTask[];
    approvers: ApprovalAssignmentOption[];
  }>;
  assign(input: {
    organizationId: string;
    workflowTaskId: string;
    actorUserId: string;
    approverUserId: string;
    reason: string;
    occurredAt: Date;
  }): Promise<boolean>;
}

export class ApprovalAssignmentService {
  constructor(
    private readonly store: ApprovalAssignmentStore,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  list(context: AuthorizationContext, organizationId: string) {
    requireAuthorization(context, {
      organizationId,
      permission: "document.review.manage",
    });
    return this.store.list(organizationId);
  }

  async listApprovers(context: AuthorizationContext, organizationId: string) {
    requireAuthorization(context, {
      organizationId,
      permission: "document.submit",
    });
    const result = await this.store.list(organizationId);
    return { approvers: result.approvers };
  }

  async assign(
    context: AuthorizationContext,
    input: {
      organizationId: string;
      workflowTaskId: string;
      approverUserId: string;
      reason: string;
    },
  ) {
    requireAuthorization(context, {
      organizationId: input.organizationId,
      permission: "document.review.manage",
    });
    if (!input.reason.trim() || input.approverUserId === context.userId)
      throw new ApprovalAssignmentValidationError(
        "A different approver and controlled reason are required",
      );
    const changed = await this.store.assign({
      ...input,
      reason: input.reason.trim(),
      actorUserId: context.userId,
      occurredAt: this.clock(),
    });
    if (!changed) throw new ApprovalAssignmentConflictError();
    return { assigned: true } as const;
  }
}

export class ApprovalAssignmentValidationError extends Error {}
export class ApprovalAssignmentConflictError extends Error {
  constructor() {
    super("The approval task is no longer assignable");
  }
}
