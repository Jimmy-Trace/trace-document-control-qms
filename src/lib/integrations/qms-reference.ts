import { db } from "../db";
import type { ExternalIntegrationContext } from "./integration-clients";
import { IntegrationClientError, requireIntegrationScope } from "./integration-clients";

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

export type EquipmentLifecycleStatus = "PLANNED" | "ACTIVE" | "OUT_OF_SERVICE" | "RETIRED";

export type EquipmentStatusReference = {
  equipmentId: string;
  equipmentNumber: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  status: EquipmentLifecycleStatus;
  siteId: string | null;
  departmentId: string | null;
  calibrationRequired: boolean;
  nextCalibrationDueAt: Date | null;
  maintenanceRequired: boolean;
  nextMaintenanceDueAt: Date | null;
  activeComplianceHoldCount: number;
  operationallyUsable: boolean;
};

export type MaterialLotLifecycleStatus = "RECEIVED" | "ACCEPTED" | "QUARANTINED" | "REJECTED" | "EXPIRED" | "RECALLED" | "DEPLETED";

export type MaterialLotStatusReference = {
  materialId: string;
  materialNumber: string;
  materialName: string;
  manufacturer: string | null;
  catalogNumber: string | null;
  materialStatus: "ACTIVE" | "INACTIVE";
  materialLotId: string;
  lotNumber: string;
  status: MaterialLotLifecycleStatus;
  receivedAt: Date;
  expirationDate: Date | null;
  quantityReceived: string | null;
  unitOfMeasure: string | null;
  siteId: string | null;
  departmentId: string | null;
};

export function normalizeReferenceLimit(raw: string | null) {
  if (raw === null) return 50;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
    throw new IntegrationClientError("limit must be an integer from 1 to 100");
  }
  return parsed;
}

export function deriveEquipmentOperationalUsable(status: EquipmentLifecycleStatus, activeComplianceHoldCount: number) {
  return status === "ACTIVE" && activeComplianceHoldCount === 0;
}

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

export async function listEquipmentStatusReferences(
  context: ExternalIntegrationContext,
  input?: { limit?: number },
): Promise<EquipmentStatusReference[]> {
  requireIntegrationScope(context, "qms.read");
  const limit = Math.max(1, Math.min(100, input?.limit ?? 50));

  return db.$transaction(async tx => {
    const rows = await tx.$queryRaw<Array<Omit<EquipmentStatusReference, "operationallyUsable">>>`
      SELECT
        e.id AS "equipmentId",
        e."equipmentNumber",
        e.name,
        e.manufacturer,
        e.model,
        e."serialNumber",
        e.status,
        e."siteId",
        e."departmentId",
        e."calibrationRequired",
        e."nextCalibrationDueAt",
        e."maintenanceRequired",
        e."nextMaintenanceDueAt",
        COUNT(h.id)::int AS "activeComplianceHoldCount"
      FROM "Equipment" e
      LEFT JOIN "EquipmentComplianceHold" h
        ON h."organizationId" = e."organizationId"
       AND h."equipmentId" = e.id
       AND h."clearedAt" IS NULL
      WHERE e."organizationId" = ${context.organizationId}::uuid
      GROUP BY e.id
      ORDER BY e."equipmentNumber" ASC, e.id ASC
      LIMIT ${limit}
    `;

    const result = rows.map(row => ({
      ...row,
      operationallyUsable: deriveEquipmentOperationalUsable(row.status, row.activeComplianceHoldCount),
    }));

    await tx.$executeRaw`
      INSERT INTO "IntegrationAccessEvent" ("organizationId","integrationClientId",resource,operation,"recordCount")
      VALUES (${context.organizationId}::uuid,${context.integrationClientId}::uuid,'equipment-status','READ',${result.length})
    `;

    return result;
  });
}

export async function listMaterialLotStatusReferences(
  context: ExternalIntegrationContext,
  input?: { limit?: number },
): Promise<MaterialLotStatusReference[]> {
  requireIntegrationScope(context, "qms.read");
  const limit = Math.max(1, Math.min(100, input?.limit ?? 50));

  return db.$transaction(async tx => {
    const rows = await tx.$queryRaw<MaterialLotStatusReference[]>`
      SELECT
        m.id AS "materialId",
        m."materialNumber",
        m.name AS "materialName",
        m.manufacturer,
        m."catalogNumber",
        m.status AS "materialStatus",
        l.id AS "materialLotId",
        l."lotNumber",
        l.status,
        l."receivedAt",
        l."expirationDate",
        l."quantityReceived"::text AS "quantityReceived",
        l."unitOfMeasure",
        l."siteId",
        l."departmentId"
      FROM "MaterialLot" l
      JOIN "Material" m
        ON m."organizationId" = l."organizationId"
       AND m.id = l."materialId"
      WHERE l."organizationId" = ${context.organizationId}::uuid
      ORDER BY m."materialNumber" ASC, l."lotNumber" ASC, l.id ASC
      LIMIT ${limit}
    `;

    await tx.$executeRaw`
      INSERT INTO "IntegrationAccessEvent" ("organizationId","integrationClientId",resource,operation,"recordCount")
      VALUES (${context.organizationId}::uuid,${context.integrationClientId}::uuid,'material-lot-status','READ',${rows.length})
    `;

    return rows;
  });
}
