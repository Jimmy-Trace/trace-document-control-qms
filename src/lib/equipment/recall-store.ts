import { Prisma } from "@prisma/client";
import { db } from "../db";
import { EquipmentRecallValidationError,type EquipmentRecallRecord,type EquipmentRecallStore } from "./recall";

export class PrismaEquipmentRecallStore implements EquipmentRecallStore{
  list(organizationId:string,equipmentId:string){return db.$queryRaw<EquipmentRecallRecord[]>(Prisma.sql`SELECT * FROM "EquipmentRecall" WHERE "organizationId"=${organizationId}::uuid AND "equipmentId"=${equipmentId}::uuid ORDER BY "openedAt" DESC`);}
  async open(input:Parameters<EquipmentRecallStore["open"]>[0]){
    return db.$transaction(async tx=>{
      const equipment=(await tx.$queryRaw<Array<{id:string;equipmentNumber:string;status:string}>>(Prisma.sql`SELECT id,"equipmentNumber",status FROM "Equipment" WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.equipmentId}::uuid FOR UPDATE`))[0];
      if(!equipment)throw new EquipmentRecallValidationError("Equipment not found");if(equipment.status==="RETIRED")throw new EquipmentRecallValidationError("Retired equipment cannot be recalled");
      const existing=(await tx.$queryRaw<EquipmentRecallRecord[]>(Prisma.sql`SELECT * FROM "EquipmentRecall" WHERE "organizationId"=${input.organizationId}::uuid AND "equipmentId"=${input.equipmentId}::uuid AND status='OPEN' FOR UPDATE`))[0];if(existing)return existing;
      const recall=(await tx.$queryRaw<EquipmentRecallRecord[]>(Prisma.sql`INSERT INTO "EquipmentRecall" ("organizationId","equipmentId","reason","scopeSummary","openedByUserId") VALUES (${input.organizationId}::uuid,${input.equipmentId}::uuid,${input.reason},${input.scopeSummary},${input.actorUserId}::uuid) RETURNING *`))[0];if(!recall)throw new EquipmentRecallValidationError("Equipment recall could not be opened");
      await tx.$executeRaw(Prisma.sql`INSERT INTO "EquipmentQuarantineEvent" ("organizationId","equipmentId","recallId","action","reason","actorUserId") VALUES (${input.organizationId}::uuid,${input.equipmentId}::uuid,${recall.id}::uuid,'QUARANTINED',${input.reason},${input.actorUserId}::uuid)`);
      await tx.auditEvent.create({data:{organizationId:input.organizationId,actorUserId:input.actorUserId,action:"EQUIPMENT_RECALL_OPENED",entityType:"Equipment",entityId:input.equipmentId,reason:input.reason,metadata:{recallId:recall.id,equipmentNumber:equipment.equipmentNumber,scopeSummary:input.scopeSummary}}});
      return recall;
    });
  }
  async close(input:Parameters<EquipmentRecallStore["close"]>[0]){
    return db.$transaction(async tx=>{
      const recall=(await tx.$queryRaw<EquipmentRecallRecord[]>(Prisma.sql`SELECT * FROM "EquipmentRecall" WHERE "organizationId"=${input.organizationId}::uuid AND "equipmentId"=${input.equipmentId}::uuid AND id=${input.recallId}::uuid FOR UPDATE`))[0];if(!recall)throw new EquipmentRecallValidationError("Equipment recall not found");if(recall.status!=="OPEN")throw new EquipmentRecallValidationError("Equipment recall is already closed");
      const activeHolds=(await tx.$queryRaw<Array<{count:number}>>(Prisma.sql`SELECT count(*)::int AS count FROM "EquipmentComplianceHold" WHERE "organizationId"=${input.organizationId}::uuid AND "equipmentId"=${input.equipmentId}::uuid AND "clearedAt" IS NULL`))[0]?.count??0;if(activeHolds>0)throw new EquipmentRecallValidationError("Equipment recall cannot close while compliance holds remain active");
      const updated=(await tx.$queryRaw<EquipmentRecallRecord[]>(Prisma.sql`UPDATE "EquipmentRecall" SET status='CLOSED',"closedByUserId"=${input.actorUserId}::uuid,"closedAt"=CURRENT_TIMESTAMP,"closureReason"=${input.reason} WHERE id=${input.recallId}::uuid RETURNING *`))[0];if(!updated)throw new EquipmentRecallValidationError("Equipment recall could not be closed");
      await tx.$executeRaw(Prisma.sql`INSERT INTO "EquipmentQuarantineEvent" ("organizationId","equipmentId","recallId","action","reason","actorUserId") VALUES (${input.organizationId}::uuid,${input.equipmentId}::uuid,${input.recallId}::uuid,'RELEASED',${input.reason},${input.actorUserId}::uuid)`);
      await tx.auditEvent.create({data:{organizationId:input.organizationId,actorUserId:input.actorUserId,action:"EQUIPMENT_RECALL_CLOSED",entityType:"Equipment",entityId:input.equipmentId,reason:input.reason,metadata:{recallId:input.recallId}}});return updated;
    });
  }
}
