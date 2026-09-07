import { Prisma } from "@prisma/client";
import { db } from "../db";
import type { ControlledCopyRecord, ControlledCopyStore } from "./controlled-copies";

type Row = ControlledCopyRecord & { versionStatus?: string };

export class PrismaControlledCopyStore implements ControlledCopyStore {
  async issue(input: {
    organizationId: string;
    documentVersionId: string;
    recipientName: string;
    location: string | null;
    purpose: string;
    issuedByUserId: string;
    issuedAt: Date;
  }): Promise<ControlledCopyRecord> {
    return db.$transaction(async (tx) => {
      const versions = await tx.$queryRaw<Array<{ id: string; status: string }>>(Prisma.sql`
        SELECT "id", "status"::text AS "status"
        FROM "DocumentVersion"
        WHERE "organizationId" = ${input.organizationId}::uuid
          AND "id" = ${input.documentVersionId}::uuid
        FOR UPDATE
      `);
      if (versions[0]?.status !== "EFFECTIVE") throw new ControlledCopyEligibilityError();
      const next = await tx.$queryRaw<Array<{ value: bigint }>>(Prisma.sql`
        SELECT COALESCE(MAX("copyNumber"), 0) + 1 AS value
        FROM "ControlledCopy"
        WHERE "organizationId" = ${input.organizationId}::uuid
          AND "documentVersionId" = ${input.documentVersionId}::uuid
      `);
      const rows = await tx.$queryRaw<Row[]>(Prisma.sql`
        INSERT INTO "ControlledCopy" (
          "organizationId","documentVersionId","copyNumber","recipientName","location","purpose","issuedByUserId","issuedAt"
        ) VALUES (
          ${input.organizationId}::uuid, ${input.documentVersionId}::uuid, ${Number(next[0]?.value ?? BigInt(1))},
          ${input.recipientName}, ${input.location}, ${input.purpose}, ${input.issuedByUserId}::uuid, ${input.issuedAt}
        ) RETURNING *
      `);
      const row = rows[0];
      if (!row) throw new Error("Controlled copy could not be issued");
      await tx.auditEvent.create({ data: {
        organizationId: input.organizationId,
        actorUserId: input.issuedByUserId,
        action: "CONTROLLED_COPY_ISSUED",
        entityType: "ControlledCopy",
        entityId: row.id,
        entityVersion: String(row.copyNumber),
        metadata: { documentVersionId: input.documentVersionId, recipientName: input.recipientName, location: input.location, purpose: input.purpose, copyNumber: row.copyNumber },
      }});
      return row;
    });
  }

  async transition(input: {
    organizationId: string;
    copyId: string;
    actorUserId: string;
    action: "RECALL" | "RETURN" | "DESTROY";
    reason: string;
    at: Date;
  }): Promise<ControlledCopyRecord | null> {
    return db.$transaction(async (tx) => {
      const current = await tx.$queryRaw<Row[]>(Prisma.sql`
        SELECT * FROM "ControlledCopy"
        WHERE "organizationId" = ${input.organizationId}::uuid AND "id" = ${input.copyId}::uuid
        FOR UPDATE
      `);
      const row = current[0];
      if (!row) return null;
      const nextStatus = input.action === "RECALL" ? "RECALL_REQUESTED" : input.action === "RETURN" ? "RETURNED" : "DESTROYED";
      const allowed = input.action === "RECALL" ? row.status === "ISSUED" : ["ISSUED","RECALL_REQUESTED"].includes(row.status);
      if (!allowed) return null;
      const updated = await tx.$queryRaw<Row[]>(Prisma.sql`
        UPDATE "ControlledCopy"
        SET "status" = ${nextStatus}::"ControlledCopyStatus",
            "recallRequestedAt" = CASE WHEN ${input.action} = 'RECALL' THEN ${input.at} ELSE "recallRequestedAt" END,
            "closedAt" = CASE WHEN ${input.action} IN ('RETURN','DESTROY') THEN ${input.at} ELSE NULL END,
            "closureReason" = CASE WHEN ${input.action} IN ('RETURN','DESTROY') THEN ${input.reason} ELSE "closureReason" END
        WHERE "organizationId" = ${input.organizationId}::uuid AND "id" = ${input.copyId}::uuid
        RETURNING *
      `);
      const result = updated[0];
      if (!result) return null;
      await tx.auditEvent.create({ data: {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        action: `CONTROLLED_COPY_${input.action}`,
        entityType: "ControlledCopy",
        entityId: input.copyId,
        entityVersion: String(result.copyNumber),
        metadata: { fromStatus: row.status, toStatus: result.status, reason: input.reason, documentVersionId: result.documentVersionId, copyNumber: result.copyNumber },
      }});
      return result;
    });
  }

  async list(organizationId: string): Promise<ControlledCopyRecord[]> {
    return db.$queryRaw<ControlledCopyRecord[]>(Prisma.sql`
      SELECT * FROM "ControlledCopy"
      WHERE "organizationId" = ${organizationId}::uuid
      ORDER BY "issuedAt" DESC
      LIMIT 250
    `);
  }
}

export class ControlledCopyEligibilityError extends Error {
  constructor() { super("Controlled copies may only be issued from an effective document version"); }
}
