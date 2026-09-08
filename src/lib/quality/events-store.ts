import { Prisma } from "@prisma/client";
import { db } from "../db";
import { QualityEventValidationError, type QualityEventRecord, type QualityEventStatus, type QualityEventStore } from "./events";

export class PrismaQualityEventStore implements QualityEventStore {
  listEvents(organizationId:string,status?:QualityEventStatus) {
    return db.$queryRaw<QualityEventRecord[]>(status
      ? Prisma.sql`SELECT * FROM "QualityEvent" WHERE "organizationId"=${organizationId}::uuid AND "status"=${status}::"QualityEventStatus" ORDER BY "createdAt" DESC`
      : Prisma.sql`SELECT * FROM "QualityEvent" WHERE "organizationId"=${organizationId}::uuid ORDER BY "createdAt" DESC`);
  }

  async createEvent(input:{organizationId:string;type:QualityEventRecord["type"];severity:QualityEventRecord["severity"];source:QualityEventRecord["source"];summary:string;description:string|null;discoveredAt:Date;ownerUserId:string|null;dueAt:Date|null;actorUserId:string}) {
    return db.$transaction(async tx=>{
      if(input.ownerUserId){
        const owner=await tx.user.findFirst({where:{organizationId:input.organizationId,id:input.ownerUserId,status:"ACTIVE"},select:{id:true}});
        if(!owner) throw new Error("Access denied");
      }
      await tx.$executeRaw(Prisma.sql`INSERT INTO "QualityEventCounter" ("organizationId","nextNumber") VALUES (${input.organizationId}::uuid,1) ON CONFLICT ("organizationId") DO NOTHING`);
      const counter=await tx.$queryRaw<Array<{number:number}>>(Prisma.sql`UPDATE "QualityEventCounter" SET "nextNumber"="nextNumber"+1 WHERE "organizationId"=${input.organizationId}::uuid RETURNING "nextNumber"-1 AS "number"`);
      const sequence=counter[0]?.number;
      if(!sequence) throw new QualityEventValidationError("Quality event number could not be allocated");
      const year=input.discoveredAt.getUTCFullYear();
      const eventNumber=`QE-${year}-${String(sequence).padStart(6,"0")}`;
      const rows=await tx.$queryRaw<QualityEventRecord[]>(Prisma.sql`INSERT INTO "QualityEvent" ("organizationId","eventNumber","type","severity","source","summary","description","discoveredAt","reportedByUserId","ownerUserId","dueAt") VALUES (${input.organizationId}::uuid,${eventNumber},${input.type}::"QualityEventType",${input.severity}::"QualityEventSeverity",${input.source}::"QualityEventSource",${input.summary},${input.description},${input.discoveredAt},${input.actorUserId}::uuid,${input.ownerUserId}::uuid,${input.dueAt}) RETURNING *`);
      const event=rows[0];
      if(!event) throw new QualityEventValidationError("Quality event could not be created");
      await tx.auditEvent.create({data:{organizationId:input.organizationId,actorUserId:input.actorUserId,action:"QUALITY_EVENT_CREATED",entityType:"QualityEvent",entityId:event.id,metadata:{eventNumber:event.eventNumber,type:event.type,severity:event.severity,source:event.source,status:event.status,ownerUserId:event.ownerUserId,dueAt:event.dueAt?.toISOString()??null}}});
      return event;
    });
  }
}
