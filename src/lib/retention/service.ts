import { requireAuthorization, type AuthorizationContext } from "../security/authorization";

export type HoldEntityType = "Document" | "DocumentVersion" | "FileObject" | "QualityRecord";
export type DispositionState = "HELD" | "RETAINED" | "ELIGIBLE";
export interface DispositionStatus {
  entityType: HoldEntityType;
  entityId: string;
  state: DispositionState;
  activeHoldIds: string[];
  retentionPolicyIds: string[];
  retentionEligibleAt: Date | null;
}
export interface RetentionStore {
  list(organizationId: string): Promise<{
    policies: Array<{ id: string; recordType: string; jurisdiction: string | null; retentionDays: number; active: boolean }>;
    holds: Array<{ id: string; entityType: string; entityId: string; reason: string; status: string; createdAt: Date; releasedAt: Date | null; releaseReason: string | null }>;
  }>;
  dispositionStatus(input: { organizationId: string; entityType: HoldEntityType; entityId: string; now: Date }): Promise<DispositionStatus>;
  createPolicy(input: { organizationId: string; recordType: string; jurisdiction: string | null; retentionDays: number; actorUserId: string; occurredAt: Date }): Promise<{ id: string }>;
  setPolicyActive(input: { organizationId: string; policyId: string; active: boolean; actorUserId: string; occurredAt: Date }): Promise<void>;
  createHold(input: { organizationId: string; entityType: HoldEntityType; entityId: string; reason: string; actorUserId: string; occurredAt: Date }): Promise<{ id: string }>;
  releaseHold(input: { organizationId: string; holdId: string; reason: string; actorUserId: string; occurredAt: Date }): Promise<void>;
}

export class RetentionService {
  constructor(private readonly store: RetentionStore, private readonly clock: () => Date = () => new Date()) {}

  async list(context: AuthorizationContext, organizationId: string) {
    requireAuthorization(context, { organizationId, permission: "administration.manage" });
    return this.store.list(organizationId);
  }

  async dispositionStatus(context: AuthorizationContext, input: { organizationId: string; entityType: HoldEntityType; entityId: string }) {
    requireAuthorization(context, { organizationId: input.organizationId, permission: "administration.manage" });
    return this.store.dispositionStatus({ ...input, now: this.clock() });
  }

  async createPolicy(context: AuthorizationContext, input: { organizationId: string; recordType: string; jurisdiction?: string | null; retentionDays: number }) {
    requireAuthorization(context, { organizationId: input.organizationId, permission: "administration.manage" });
    const recordType = clean(input.recordType, "Record type", 80);
    const jurisdiction = input.jurisdiction?.trim() || null;
    if (!Number.isInteger(input.retentionDays) || input.retentionDays < 1 || input.retentionDays > 36500) throw new RetentionValidationError("Retention days must be between 1 and 36500");
    return this.store.createPolicy({ organizationId: input.organizationId, recordType, jurisdiction, retentionDays: input.retentionDays, actorUserId: context.userId, occurredAt: this.clock() });
  }

  async setPolicyActive(context: AuthorizationContext, input: { organizationId: string; policyId: string; active: boolean }) {
    requireAuthorization(context, { organizationId: input.organizationId, permission: "administration.manage" });
    await this.store.setPolicyActive({ ...input, actorUserId: context.userId, occurredAt: this.clock() });
  }

  async createHold(context: AuthorizationContext, input: { organizationId: string; entityType: HoldEntityType; entityId: string; reason: string }) {
    requireAuthorization(context, { organizationId: input.organizationId, permission: "administration.manage" });
    return this.store.createHold({ ...input, reason: clean(input.reason, "Hold reason", 500), actorUserId: context.userId, occurredAt: this.clock() });
  }

  async releaseHold(context: AuthorizationContext, input: { organizationId: string; holdId: string; reason: string }) {
    requireAuthorization(context, { organizationId: input.organizationId, permission: "administration.manage" });
    await this.store.releaseHold({ ...input, reason: clean(input.reason, "Release reason", 500), actorUserId: context.userId, occurredAt: this.clock() });
  }
}

function clean(value: string, label: string, max: number) {
  const result = value.trim();
  if (!result || result.length > max) throw new RetentionValidationError(`${label} is required and must be ${max} characters or fewer`);
  return result;
}

export class RetentionValidationError extends Error {}
export class DispositionBlockedError extends Error {}
