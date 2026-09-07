import type { AuthorizationContext } from "../security/authorization";
import { requireAuthorization } from "../security/authorization";

export type OrganizationalAudienceType = "SITE" | "DEPARTMENT";
export interface OrganizationalAudienceOption { id: string; name: string; memberCount: number; }
export interface OrganizationalAudienceStore {
  listOptions(organizationId: string): Promise<{ sites: OrganizationalAudienceOption[]; departments: OrganizationalAudienceOption[]; documents: Array<{ versionId: string; documentNumber: string; title: string; revisionLabel: string }> }>;
  assignAudience(input: { organizationId: string; audienceType: OrganizationalAudienceType; audienceId: string; versionId: string; dueAt: Date; assignedAt: Date; assignedByUserId: string }): Promise<{ created: number; skippedExisting: number; recipientUserIds: string[] }>;
}

export class OrganizationalAudienceDistributionService {
  constructor(private readonly store: OrganizationalAudienceStore, private readonly clock: () => Date = () => new Date()) {}

  async listOptions(context: AuthorizationContext, organizationId: string) {
    requireAuthorization(context, { organizationId, permission: "document.distribute" });
    return this.store.listOptions(organizationId);
  }

  async assign(context: AuthorizationContext, input: { organizationId: string; audienceType: OrganizationalAudienceType; audienceId: string; versionId: string; dueAt: Date }) {
    requireAuthorization(context, { organizationId: input.organizationId, permission: "document.distribute" });
    const now = this.clock();
    if (input.dueAt <= now) throw new OrganizationalAudienceValidationError("Due date must be in the future");
    return this.store.assignAudience({ ...input, assignedAt: now, assignedByUserId: context.userId });
  }
}

export class OrganizationalAudienceValidationError extends Error {}
