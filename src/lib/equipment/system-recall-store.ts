import { Prisma } from "@prisma/client";
import { db } from "../db";
import { EquipmentRecallValidationError,type EquipmentRecallRecord } from "./recall";

export class PrismaEquipmentSystemRecallStore{
  async ingest(input:{organizationId:string;equipmentId:string;sourceSystem:string;sourceKey:string;reason:string;scopeSummary:string;payloadHash:string}){
    return db.$transaction(async tx=>{
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${input.organizationId}:${input.sourceSystem}:${input.sourceKey}`},0))`);
      const existing=(await tx.$queryRaw<EquipmentRecallRecord[]>(Prisma.sql`SELECT * FROM "EquipmentRecall" WHERE "organizationId"=${input.organizationId}::uuid AND "sourceSystem"=${input.sourceSystem} AND "sourceKey"=${input.sourceKey} LIMIT 1`))[0] as (EquipmentRecallRecord&{payloadHash?:string})|undefined;
      if(existing){const hash=(await tx.$queryRaw<Array<{payloadHash:string|null}>>(Prisma.sql`SELECT "payloadHash" FROM "EquipmentRecall" WHERE id=${existing.id}::uuid`))[0]?.payloadHash;if(hash!==input.payloadHash)throw new EquipmentRecallValidationError("System recall source key was already used with different content");return {created:false,recall:existing};}
      const equipment=(await tx.$queryRaw<Array<{id:string;equipmentNumber:string;status:string}>>(Prisma.sql`SELECT id,"equipmentNumber",status FROM "Equipment" WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.equipmentId}::uuid FOR UPDATE`))[0];
      if(!equipment)throw new EquipmentRecallValidationError("Equipment not found");if(equipment.status==="RETIRED")throw new EquipmentRecallValidationError("Retired equipment cannot be recalled");
      const openRecall=(await tx.$queryRaw<EquipmentRecallRecord[]>(Prisma.sql`SELECT * FROM "EquipmentRecall" WHERE "organizationId"=${input.organizationId}::uuid AND "equipmentId"=${input.equipmentId}::uuid AND status='OPEN' FOR UPDATE`))[0];if(openRecall)return {created:false,recall:openRecall};
      const recall=(await tx.$queryRaw<EquipmentRecallRecord[]>(Prisma.sql`INSERT INTO "EquipmentRecall" ("organizationId","equipmentId","reason","scopeSummary","openedByUserId","sourceSystem","sourceKey","payloadHash") VALUES (${input.organizationId}::uuid,${input.equipmentId}::uuid,${input.reason},${input.scopeSummary},NULL,${input.sourceSystem},${input.sourceKey},${input.payloadHash}) RETURNING *`))[0];if(!recall)throw new EquipmentRecallValidationError("System equipment recall could not be opened");
      await tx.$executeRaw(Prisma.sql`INSERT INTO "EquipmentQuarantineEvent" ("organizationId","equipmentId","recallId","action","reason","actorUserId") VALUES (${input.organizationId}::uuid,${input.equipmentId}::uuid,${recall.id}::uuid,'QUARANTINED',${input.reason},NULL)`);
      await tx.auditEvent.create({data:{organizationId:input.organizationId,action:"EQUIPMENT_SYSTEM_RECALL_OPENED",entityType:"Equipment",entityId:input.equipmentId,reason:input.reason,metadata:{recallId:recall.id,equipmentNumber:equipment.equipmentNumber,sourceSystem:input.sourceSystem,sourceKey:input.sourceKey,payloadHash:input.payloadHash,scopeSummary:input.scopeSummary}}});
      return {created:true,recall};
    });
  }
}
