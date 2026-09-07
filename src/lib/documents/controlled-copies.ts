import type { AuthorizationContext } from "../security/authorization";
import { requireAuthorization } from "../security/authorization";

export type ControlledCopyStatus = "ISSUED" | "RECALL_REQUESTED" | "RETURNED" | "DESTROYED";

export interface ControlledCopyRecord {
  id: string;
  organizationId: string;
  documentVersionId: string;
  copyNumber: number;
  recipientName: string;
  location: string | null;
  purpose: string;
  status: ControlledCopyStatus;
  issuedAt: Date;
  recallRequestedAt: Date | null;
  closedAt: Date | null;
  closureReason: string | null;
}

export interface ControlledCopyStore {
  issue(input: {
    organizationId: string;
    documentVersionId: string;
    recipientName: string;
    location: string | null;
    purpose: string;
    issuedByUserId: string;
    issuedAt: Date;
  }): Promise<ControlledCopyRecord>;
  transition(input: {
    organizationId: string;
    copyId: string;
    actorUserId: string;
    action: "RECALL" | "RETURN" | "DESTROY";
    reason: string;
    at: Date;
  }): Promise<ControlledCopyRecord | null>;
  list(organizationId: string): Promise<ControlledCopyRecord[]>;
}

export class ControlledCopyService {
  constructor(private readonly store: ControlledCopyStore, private readonly clock: () => Date = () => new Date()) {}

  async issue(context: AuthorizationContext, input: {
    organizationId: string;
    documentVersionId: string;
    recipientName: string;
    location?: string | null;
    purpose: string;
  }) {
    requireAuthorization(context, { organizationId: input.organizationId, permission: "document.distribute" });
    const recipientName = input.recipientName.trim();
    const purpose = input.purpose.trim();
    const location = input.location?.trim() || null;
    if (!recipientName || !purpose) throw new ControlledCopyValidationError("Recipient and purpose are required");
    return this.store.issue({ ...input, recipientName, purpose, location, issuedByUserId: context.userId, issuedAt: this.clock() });
  }

  async transition(context: AuthorizationContext, input: {
    organizationId: string;
    copyId: string;
    action: "RECALL" | "RETURN" | "DESTROY";
    reason: string;
  }) {
    requireAuthorization(context, { organizationId: input.organizationId, permission: "document.distribute" });
    const reason = input.reason.trim();
    if (!reason) throw new ControlledCopyValidationError("A reason is required");
    const result = await this.store.transition({ ...input, actorUserId: context.userId, reason, at: this.clock() });
    if (!result) throw new ControlledCopyConflictError();
    return result;
  }

  async list(context: AuthorizationContext, organizationId: string) {
    requireAuthorization(context, { organizationId, permission: "document.distribute" });
    return this.store.list(organizationId);
  }
}

export class ControlledCopyValidationError extends Error {}
export class ControlledCopyConflictError extends Error {
  constructor() { super("Controlled copy state changed; reload and try again"); }
}
