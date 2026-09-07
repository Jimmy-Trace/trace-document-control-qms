import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "../db";
import { requireAuthorization, type AuthorizationContext } from "../security/authorization";
import { PrivateObjectStorage } from "../storage/s3";

export type ControlledRecordExport = {
  bytes: Uint8Array;
  mimeType: string;
  filename: string;
  sha256: string;
  recordId: string;
  recordNumber: string;
  title: string;
  status: string;
  recordTypeCode: string;
  recordTypeName: string;
  fileId: string;
};

export async function exportQualityRecord(
  context: AuthorizationContext,
  input: { organizationId: string; recordId: string; reason: string },
): Promise<ControlledRecordExport> {
  requireAuthorization(context, { organizationId: input.organizationId, permission: "record.export" });
  const reason = input.reason.trim();
  if (!reason || reason.length > 500) throw new RecordExportValidationError("Export reason is required and must be 500 characters or fewer");

  const rows = await db.$queryRaw<Array<{
    recordId: string;
    recordNumber: string;
    title: string;
    status: string;
    recordTypeCode: string;
    recordTypeName: string;
    fileId: string | null;
    storageKey: string | null;
    originalName: string | null;
    mimeType: string | null;
    fileSha256: string | null;
    fileStatus: string | null;
  }>>(Prisma.sql`
    SELECT q."id" AS "recordId", q."recordNumber", q."title", q."status"::text AS "status",
           t."code" AS "recordTypeCode", t."name" AS "recordTypeName",
           f."id" AS "fileId", f."storageKey", f."originalName", f."mimeType",
           f."sha256" AS "fileSha256", f."status"::text AS "fileStatus"
    FROM "QualityRecord" q
    JOIN "RecordType" t ON t."organizationId" = q."organizationId" AND t."id" = q."recordTypeId"
    LEFT JOIN "FileObject" f ON f."organizationId" = q."organizationId" AND f."id" = q."fileId"
    WHERE q."organizationId" = ${input.organizationId}::uuid AND q."id" = ${input.recordId}::uuid
  `);
  const record = rows[0];
  if (!record) throw new Error("Access denied");
  if (!record.fileId || !record.storageKey || !record.originalName || !record.mimeType || !record.fileSha256 || record.fileStatus !== "AVAILABLE") {
    throw new RecordExportValidationError("This regulated record does not have an available governed file to export");
  }

  const bytes = await new PrivateObjectStorage().get(record.storageKey);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (sha256 !== record.fileSha256) throw new RecordExportIntegrityError("Regulated record file integrity check failed");

  await db.auditEvent.create({
    data: {
      organizationId: input.organizationId,
      actorUserId: context.userId,
      action: "QUALITY_RECORD_EXPORTED",
      entityType: "QualityRecord",
      entityId: record.recordId,
      entityVersion: record.recordNumber,
      newHash: sha256,
      reason,
      metadata: {
        recordNumber: record.recordNumber,
        title: record.title,
        recordStatus: record.status,
        recordTypeCode: record.recordTypeCode,
        recordTypeName: record.recordTypeName,
        fileId: record.fileId,
        originalName: record.originalName,
        fileSha256: record.fileSha256,
      },
    },
  });

  return {
    bytes,
    mimeType: record.mimeType,
    filename: record.originalName,
    sha256,
    recordId: record.recordId,
    recordNumber: record.recordNumber,
    title: record.title,
    status: record.status,
    recordTypeCode: record.recordTypeCode,
    recordTypeName: record.recordTypeName,
    fileId: record.fileId,
  };
}

export class RecordExportValidationError extends Error {}
export class RecordExportIntegrityError extends Error {}
