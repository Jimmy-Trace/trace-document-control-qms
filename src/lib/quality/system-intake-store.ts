import { Prisma } from "@prisma/client";
import { db } from "../db";
import { QualityEventValidationError, type QualityEventRecord, type QualityEventSeverity, type QualityEventType } from "./events";

export type SystemQualityEventInput = {
  organizationId: string;
  sourceSystem: string;
  sourceKey: string;
  payloadHash: string;
  reportedByUserId: string;
  ownerUserId: string | null;
  type: QualityEventType;
  severity: QualityEventSeverity;
  summary: string;
  description: string | null;
  discoveredAt: Date;
  dueAt: Date | null;
};

export class PrismaQualityEventSystemIntakeStore {
  async ingest(input: SystemQualityEventInput) {
    return db.$transaction(async tx => {
      await tx.$queryRaw<Array<{ locked: boolean }>>(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${input.organizationId}:${input.sourceSystem}:${input.sourceKey}`},0)) IS NULL AS "locked"`);
      const existing = await tx.$queryRaw<QualityEventRecord[]>(Prisma.sql`
        SELECT e.* FROM "QualityEventSystemTrigger" t
        JOIN "QualityEvent" e ON e."organizationId"=t."organizationId" AND e."id"=t."eventId"
        WHERE t."organizationId"=${input.organizationId}::uuid AND t."sourceSystem"=${input.sourceSystem} AND t."sourceKey"=${input.sourceKey}
      `);
      if(existing[0]) return { event: existing[0], created: false };

      const reporter=await tx.user.findFirst({where:{organizationId:input.organizationId,id:input.reportedByUserId,status:"ACTIVE"},select:{id:true}});
      if(!reporter) throw new QualityEventValidationError("System event reporter must be an active same-tenant user");
      if(input.ownerUserId){
        const owner=await tx.user.findFirst({where:{organizationId:input.organizationId,id:input.ownerUserId,status:"ACTIVE"},select:{id:true}});
        if(!owner) throw new QualityEventValidationError("System event owner must be an active same-tenant user");
      }

      await tx.$executeRaw(Prisma.sql`INSERT INTO "QualityEventCounter" ("organizationId","nextNumber") VALUES (${input.organizationId}::uuid,1) ON CONFLICT ("organizationId") DO NOTHING`);
      const counter=await tx.$queryRaw<Array<{number:number}>>(Prisma.sql`UPDATE "QualityEventCounter" SET "nextNumber"="nextNumber"+1 WHERE "organizationId"=${input.organizationId}::uuid RETURNING "nextNumber"-1 AS "number"`);
      const sequence=counter[0]?.number;
      if(!sequence) throw new QualityEventValidationError("Quality event number could not be allocated");
      const eventNumber=`QE-${input.discoveredAt.getUTCFullYear()}-${String(sequence).padStart(6,"0")}`;
      const rows=await tx.$queryRaw<QualityEventRecord[]>(Prisma.sql`
        INSERT INTO "QualityEvent" ("organizationId","eventNumber","type","severity","source","summary","description","discoveredAt","reportedByUserId","ownerUserId","dueAt")
        VALUES (${input.organizationId}::uuid,${eventNumber},${input.type}::"QualityEventType",${input.severity}::"QualityEventSeverity",'SYSTEM',${input.summary},${input.description},${input.discoveredAt},${input.reportedByUserId}::uuid,${input.ownerUserId}::uuid,${input.dueAt}) RETURNING *
      `);
      const event=rows[0];
      if(!event) throw new QualityEventValidationError("System quality event could not be created");
      await tx.$executeRaw(Prisma.sql`INSERT INTO "QualityEventSystemTrigger" ("organizationId","sourceSystem","sourceKey","eventId","payloadHash") VALUES (${input.organizationId}::uuid,${input.sourceSystem},${input.sourceKey},${event.id}::uuid,${input.payloadHash})`);
      await tx.auditEvent.create({data:{organizationId:input.organizationId,actorUserId:input.reportedByUserId,action:"QUALITY_EVENT_SYSTEM_CREATED",entityType:"QualityEvent",entityId:event.id,metadata:{eventNumber:event.eventNumber,sourceSystem:input.sourceSystem,sourceKey:input.sourceKey,payloadHash:input.payloadHash,type:event.type,severity:event.severity}}});
      return { event, created: true };
    });
  }
}
