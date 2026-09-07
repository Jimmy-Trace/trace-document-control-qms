import { createHash } from "node:crypto";
import { db } from "../db";
import { requireAuthorization, type AuthorizationContext } from "../security/authorization";
import { PrivateObjectStorage } from "../storage/s3";

export type ControlledExport = {
  bytes: Uint8Array;
  mimeType: string;
  filename: string;
  sha256: string;
  documentNumber: string;
  title: string;
  revisionLabel: string;
  status: string;
};

export async function exportControlledDocument(
  context: AuthorizationContext,
  input: { organizationId: string; versionId: string; reason: string },
): Promise<ControlledExport> {
  requireAuthorization(context, { organizationId: input.organizationId, permission: "document.export" });
  const reason = input.reason.trim();
  if (!reason || reason.length > 500) throw new ControlledExportValidationError("Export reason is required and must be 500 characters or fewer");

  const version = await db.documentVersion.findFirst({
    where: { organizationId: input.organizationId, id: input.versionId },
    select: {
      id: true,
      revisionLabel: true,
      status: true,
      contentHash: true,
      file: { select: { id: true, storageKey: true, originalName: true, mimeType: true, sha256: true, status: true } },
      document: { select: { id: true, documentNumber: true, title: true } },
    },
  });
  if (!version) throw new Error("Access denied");
  if (!version.file || version.file.status !== "AVAILABLE") throw new ControlledExportValidationError("This controlled version does not have an available file to export");

  const bytes = await new PrivateObjectStorage().get(version.file.storageKey);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (sha256 !== version.file.sha256) throw new ControlledExportIntegrityError("Controlled file integrity check failed");

  await db.auditEvent.create({
    data: {
      organizationId: input.organizationId,
      actorUserId: context.userId,
      action: "CONTROLLED_DOCUMENT_EXPORTED",
      entityType: "DocumentVersion",
      entityId: version.id,
      newHash: sha256,
      reason,
      metadata: {
        documentId: version.document.id,
        documentNumber: version.document.documentNumber,
        title: version.document.title,
        revisionLabel: version.revisionLabel,
        versionStatus: version.status,
        fileId: version.file.id,
        originalName: version.file.originalName,
        fileSha256: version.file.sha256,
        versionContentHash: version.contentHash,
      },
    },
  });

  return {
    bytes,
    mimeType: version.file.mimeType,
    filename: version.file.originalName,
    sha256,
    documentNumber: version.document.documentNumber,
    title: version.document.title,
    revisionLabel: version.revisionLabel,
    status: version.status,
  };
}

export class ControlledExportValidationError extends Error {}
export class ControlledExportIntegrityError extends Error {}
