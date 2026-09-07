import type { AuthorizationContext } from "../security/authorization";
import { requireAuthorization } from "../security/authorization";

export interface RoleAudienceOption { id: string; name: string; memberCount: number; }
export interface EffectiveDocumentOption { versionId: string; documentNumber: string; title: string; revisionLabel: string; }
export interface RoleAudienceStore {
  listOptions(organizationId: string): Promise<{ roles: RoleAudienceOption[]; documents: EffectiveDocumentOption[] }>;
  assignRole(input: { organizationId: string; roleId: string; versionId: string; dueAt: Date; assignedAt: Date; assignedByUserId: string }): Promise<{ created: number; skippedExisting: number; recipientUserIds: string[] }>;
}

export class RoleAudienceDistributionService {
  constructor(private readonly store: RoleAudienceStore, private readonly clock: () => Date = () => new Date()) {}

  async listOptions(context: AuthorizationContext, organizationId: string) {
    requireAuthorization(context, { organizationId, permission: "document.distribute" });
    return this.store.listOptions(organizationId);
  }

  async assign(context: AuthorizationContext, input: { organizationId: string; roleId: string; versionId: string; dueAt: Date }) {
    requireAuthorization(context, { organizationId: input.organizationId, permission: "document.distribute" });
    const now = this.clock();
    if (input.dueAt <= now) throw new RoleAudienceValidationError("Due date must be in the future");
    return this.store.assignRole({ ...input, assignedAt: now, assignedByUserId: context.userId });
  }
}

export class RoleAudienceValidationError extends Error {}
