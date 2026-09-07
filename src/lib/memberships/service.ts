import type { AuthorizationContext } from "../security/authorization";
import { requireAuthorization } from "../security/authorization";

export interface MembershipOptions {
  users: Array<{ id: string; name: string; status: string; siteIds: string[]; departmentIds: string[] }>;
  sites: Array<{ id: string; name: string; active: boolean }>;
  departments: Array<{ id: string; name: string; siteId: string | null; active: boolean }>;
}

export interface MembershipStore {
  listOptions(organizationId: string): Promise<MembershipOptions>;
  replaceUserMemberships(input: {
    organizationId: string;
    userId: string;
    siteIds: string[];
    departmentIds: string[];
    assignedByUserId: string;
    reason: string;
    occurredAt: Date;
  }): Promise<{ siteCount: number; departmentCount: number }>;
}

export class MembershipService {
  constructor(private readonly store: MembershipStore, private readonly clock: () => Date = () => new Date()) {}

  async list(context: AuthorizationContext) {
    requireAuthorization(context, { organizationId: context.organizationId, permission: "administration.manage" });
    return this.store.listOptions(context.organizationId);
  }

  async replace(context: AuthorizationContext, input: { userId: string; siteIds: string[]; departmentIds: string[]; reason: string }) {
    requireAuthorization(context, { organizationId: context.organizationId, permission: "administration.manage" });
    const siteIds = [...new Set(input.siteIds)];
    const departmentIds = [...new Set(input.departmentIds)];
    if (siteIds.length !== input.siteIds.length || departmentIds.length !== input.departmentIds.length) throw new MembershipValidationError("Membership selections must be unique");
    if (!input.reason.trim()) throw new MembershipValidationError("Controlled reason is required");
    return this.store.replaceUserMemberships({
      organizationId: context.organizationId,
      userId: input.userId,
      siteIds,
      departmentIds,
      assignedByUserId: context.userId,
      reason: input.reason.trim(),
      occurredAt: this.clock(),
    });
  }
}

export class MembershipValidationError extends Error {}
