import { db } from "../db";
import type { ExternalIntegrationContext } from "./integration-clients";
import { requireIntegrationScope } from "./integration-clients";

export type EffectiveDocumentReference = {
  documentId: string;
  documentVersionId: string;
  documentNumber: string;
  title: string;
  documentTypeCode: string;
  documentTypeName: string;
  revisionLabel: string;
  effectiveAt: Date;
  contentHash: string;
};

export async function listEffectiveDocumentReferences(
  context: ExternalIntegrationContext,
  input?: { limit?: number },
): Promise<EffectiveDocumentReference[]> {
  requireIntegrationScope(context, "qms.read");
  const limit = Math.max(1, Math.min(100, input?.limit ?? 50));

  return db.$transaction(async tx => {
    const rows = await tx.document.findMany({
      where: {
        organizationId: context.organizationId,
        lifecycleState: "ACTIVE",
        currentVersion: { status: "EFFECTIVE" },
      },
      orderBy: [{ documentNumber: "asc" }, { id: "asc" }],
      take: limit,
      select: {
        id: true,
        documentNumber: true,
        title: true,
        documentType: { select: { code: true, name: true } },
        currentVersion: {
          select: {
            id: true,
            revisionLabel: true,
            effectiveAt: true,
            contentHash: true,
          },
        },
      },
    });

    const result = rows.flatMap(row => {
      const version = row.currentVersion;
      if (!version?.effectiveAt) return [];
      return [{
        documentId: row.id,
        documentVersionId: version.id,
        documentNumber: row.documentNumber,
        title: row.title,
        documentTypeCode: row.documentType.code,
        documentTypeName: row.documentType.name,
        revisionLabel: version.revisionLabel,
        effectiveAt: version.effectiveAt,
        contentHash: version.contentHash,
      }];
    });

    await tx.$executeRaw`
      INSERT INTO "IntegrationAccessEvent" ("organizationId","integrationClientId",resource,operation,"recordCount")
      VALUES (${context.organizationId}::uuid,${context.integrationClientId}::uuid,'effective-documents','READ',${result.length})
    `;

    return result;
  });
}
