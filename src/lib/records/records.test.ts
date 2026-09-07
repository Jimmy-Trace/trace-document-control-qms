import { describe, expect, it } from "vitest";
import type { AuthorizationContext } from "../security/authorization";
import { RecordEligibilityError, RecordService, RecordValidationError, type QualityRecord, type RecordStore, type RecordTypeRecord } from "./records";

const organizationId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";

function context(permission: string): AuthorizationContext {
  return {
    userId,
    organizationId,
    userState: "ACTIVE",
    grants: [{ permission, scopeType: "ORGANIZATION", scopeId: null }],
  };
}

function recordType(): RecordTypeRecord {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    organizationId,
    code: "TEMP_LOG",
    name: "Temperature Log",
    description: null,
    active: true,
    createdAt: new Date("2026-09-07T00:00:00Z"),
    updatedAt: new Date("2026-09-07T00:00:00Z"),
  };
}

function qualityRecord(status: QualityRecord["status"] = "ACTIVE"): QualityRecord {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    organizationId,
    recordTypeId: recordType().id,
    recordNumber: "REC-0001",
    title: "Synthetic temperature log",
    status,
    occurredAt: null,
    fileId: null,
    createdByUserId: userId,
    createdAt: new Date("2026-09-07T00:00:00Z"),
  };
}

function store(): RecordStore {
  return {
    async createType(input) { return { ...recordType(), code: input.code, name: input.name, description: input.description }; },
    async listTypes() { return [recordType()]; },
    async createRecord(input) { return { ...qualityRecord(), recordTypeId: input.recordTypeId, recordNumber: input.recordNumber, title: input.title, occurredAt: input.occurredAt, fileId: input.fileId, createdByUserId: input.actorUserId }; },
    async archiveRecord(input) { return input.reason === "conflict" ? null : qualityRecord("ARCHIVED"); },
    async listRecords() { return [qualityRecord()]; },
  };
}

describe("record service", () => {
  it("requires record.read to list regulated records", async () => {
    const service = new RecordService(store());
    await expect(service.listRecords({ ...context("record.read"), grants: [] }, organizationId)).rejects.toThrow("Access denied");
  });

  it("requires record.create to create a regulated record", async () => {
    const service = new RecordService(store());
    await expect(service.createRecord(context("record.read"), { organizationId, recordTypeId: recordType().id, recordNumber: "REC-1", title: "Log" })).rejects.toThrow("Access denied");
  });

  it("requires record.archive to archive a regulated record", async () => {
    const service = new RecordService(store());
    await expect(service.archiveRecord(context("record.create"), { organizationId, recordId: qualityRecord().id, reason: "Retention satisfied" })).rejects.toThrow("Access denied");
  });

  it("requires administration.manage to create record types", async () => {
    const service = new RecordService(store());
    await expect(service.createType(context("record.create"), { organizationId, code: "TEMP", name: "Temperature" })).rejects.toThrow("Access denied");
  });

  it("normalizes governed record type configuration", async () => {
    const service = new RecordService(store());
    const result = await service.createType(context("administration.manage"), { organizationId, code: " temp_log ", name: " Temperature Log ", description: " Daily log " });
    expect(result.code).toBe("TEMP_LOG");
    expect(result.name).toBe("Temperature Log");
    expect(result.description).toBe("Daily log");
  });

  it("rejects invalid record type codes", async () => {
    const service = new RecordService(store());
    await expect(service.createType(context("administration.manage"), { organizationId, code: "bad code", name: "Temperature" })).rejects.toBeInstanceOf(RecordValidationError);
  });

  it("normalizes immutable record identity fields", async () => {
    const service = new RecordService(store());
    const result = await service.createRecord(context("record.create"), { organizationId, recordTypeId: recordType().id, recordNumber: " REC-0001 ", title: " Synthetic temperature log " });
    expect(result.recordNumber).toBe("REC-0001");
    expect(result.title).toBe("Synthetic temperature log");
  });

  it("requires and normalizes an archive reason", async () => {
    const service = new RecordService(store(), () => new Date("2026-09-07T12:00:00Z"));
    const result = await service.archiveRecord(context("record.archive"), { organizationId, recordId: qualityRecord().id, reason: " Retention satisfied " });
    expect(result.status).toBe("ARCHIVED");
    await expect(service.archiveRecord(context("record.archive"), { organizationId, recordId: qualityRecord().id, reason: " " })).rejects.toBeInstanceOf(RecordValidationError);
  });

  it("surfaces stale record state as an eligibility conflict", async () => {
    const service = new RecordService(store());
    await expect(service.archiveRecord(context("record.archive"), { organizationId, recordId: qualityRecord().id, reason: "conflict" })).rejects.toBeInstanceOf(RecordEligibilityError);
  });
});
