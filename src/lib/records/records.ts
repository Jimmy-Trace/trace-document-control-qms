import type { AuthorizationContext } from "../security/authorization";
import { requireAuthorization } from "../security/authorization";

export interface RecordTypeRecord {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  description: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface QualityRecord {
  id: string;
  organizationId: string;
  recordTypeId: string;
  recordNumber: string;
  title: string;
  status: "ACTIVE" | "ARCHIVED";
  occurredAt: Date | null;
  fileId: string | null;
  createdByUserId: string;
  createdAt: Date;
}

export interface RecordStore {
  createType(input: {
    organizationId: string;
    code: string;
    name: string;
    description: string | null;
    actorUserId: string;
  }): Promise<RecordTypeRecord>;
  listTypes(organizationId: string): Promise<RecordTypeRecord[]>;
  createRecord(input: {
    organizationId: string;
    recordTypeId: string;
    recordNumber: string;
    title: string;
    occurredAt: Date | null;
    fileId: string | null;
    actorUserId: string;
  }): Promise<QualityRecord>;
  archiveRecord(input: {
    organizationId: string;
    recordId: string;
    reason: string;
    actorUserId: string;
    occurredAt: Date;
  }): Promise<QualityRecord | null>;
  listRecords(organizationId: string): Promise<QualityRecord[]>;
}

export class RecordService {
  constructor(private readonly store: RecordStore, private readonly clock: () => Date = () => new Date()) {}

  async createType(context: AuthorizationContext, input: {
    organizationId: string;
    code: string;
    name: string;
    description?: string | null;
  }) {
    requireAuthorization(context, { organizationId: input.organizationId, permission: "administration.manage" });
    const code = input.code.trim().toUpperCase();
    const name = input.name.trim();
    const description = input.description?.trim() || null;
    if (!code || !name) throw new RecordValidationError("Record type code and name are required");
    if (!/^[A-Z0-9][A-Z0-9_-]{0,39}$/.test(code)) throw new RecordValidationError("Record type code is invalid");
    return this.store.createType({ ...input, code, name, description, actorUserId: context.userId });
  }

  async listTypes(context: AuthorizationContext, organizationId: string) {
    requireAuthorization(context, { organizationId, permission: "record.read" });
    return this.store.listTypes(organizationId);
  }

  async createRecord(context: AuthorizationContext, input: {
    organizationId: string;
    recordTypeId: string;
    recordNumber: string;
    title: string;
    occurredAt?: Date | null;
    fileId?: string | null;
  }) {
    requireAuthorization(context, { organizationId: input.organizationId, permission: "record.create" });
    const recordNumber = input.recordNumber.trim();
    const title = input.title.trim();
    if (!recordNumber || !title) throw new RecordValidationError("Record number and title are required");
    if (recordNumber.length > 120 || title.length > 300) throw new RecordValidationError("Record number or title is too long");
    return this.store.createRecord({
      organizationId: input.organizationId,
      recordTypeId: input.recordTypeId,
      recordNumber,
      title,
      occurredAt: input.occurredAt ?? null,
      fileId: input.fileId ?? null,
      actorUserId: context.userId,
    });
  }

  async archiveRecord(context: AuthorizationContext, input: { organizationId: string; recordId: string; reason: string }) {
    requireAuthorization(context, { organizationId: input.organizationId, permission: "record.archive" });
    const reason = input.reason.trim();
    if (!reason || reason.length > 1000) throw new RecordValidationError("Archive reason is required and must be 1000 characters or fewer");
    const result = await this.store.archiveRecord({ ...input, reason, actorUserId: context.userId, occurredAt: this.clock() });
    if (!result) throw new RecordEligibilityError("Record is not active or its state changed; reload and try again");
    return result;
  }

  async listRecords(context: AuthorizationContext, organizationId: string) {
    requireAuthorization(context, { organizationId, permission: "record.read" });
    return this.store.listRecords(organizationId);
  }
}

export class RecordValidationError extends Error {}
export class RecordEligibilityError extends Error {}
