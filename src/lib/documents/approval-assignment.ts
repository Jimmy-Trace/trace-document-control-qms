import {
  requireAuthorization,
  type AuthorizationContext,
} from "../security/authorization";

export interface ApprovalAssignmentStore {
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
