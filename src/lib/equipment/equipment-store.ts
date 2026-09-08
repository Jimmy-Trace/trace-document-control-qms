import { Prisma } from "@prisma/client";
import { db } from "../db";
import { EquipmentValidationError,type EquipmentEventRecord,type EquipmentRecord,type EquipmentStore } from "./equipment";

export class PrismaEquipmentStore implements EquipmentStore{
  list(organizationId:string){return db.$queryRaw<EquipmentRecord[]>(Prisma.sql`SELECT * FROM "Equipment" WHERE "organizationId"=${organizationId}::uuid ORDER BY "equipmentNumber"`);}
  async create(input:Parameters<EquipmentStore["create"]>[0]){
    return db.$transaction(async tx=>{
      if(input.siteId){const site=await tx.site.findFirst({where:{organizationId:input.organizationId,id:input.siteId,active:true},select:{id:true}});if(!site)throw new Error("Access denied");}
      if(input.departmentId){const department=await tx.department.findFirst({where:{organizationId:input.organizationId,id:input.departmentId,active:true},select:{id:true,siteId:true}});if(!department||input.siteId&&department.siteId!==input.siteId)throw new Error("Access denied");}
      const rows=await tx.$queryRaw<EquipmentRecord[]>(Prisma.sql`INSERT INTO "Equipment" ("organizationId","equipmentNumber","name","manufacturer","model","serialNumber","siteId","departmentId","receivedAt","calibrationRequired","calibrationIntervalDays","nextCalibrationDueAt","maintenanceRequired","maintenanceIntervalDays","nextMaintenanceDueAt","createdByUserId") VALUES (${input.organizationId}::uuid,${input.equipmentNumber},${input.name},${input.manufacturer},${input.model},${input.serialNumber},${input.siteId}::uuid,${input.departmentId}::uuid,${input.receivedAt},${input.calibrationRequired},${input.calibrationIntervalDays},${input.nextCalibrationDueAt},${input.maintenanceRequired},${input.maintenanceIntervalDays},${input.nextMaintenanceDueAt},${input.actorUserId}::uuid) RETURNING *`);
      const equipment=rows[0];if(!equipment)throw new EquipmentValidationError("Equipment could not be created");
      await tx.auditEvent.create({data:{organizationId:input.organizationId,actorUserId:input.actorUserId,action:"EQUIPMENT_CREATED",entityType:"Equipment",entityId:equipment.id,metadata:{equipmentNumber:equipment.equipmentNumber,status:equipment.status,siteId:equipment.siteId,departmentId:equipment.departmentId}}});return equipment;
    });
  }
  listEvents(organizationId:string,equipmentId:string){return db.$queryRaw<EquipmentEventRecord[]>(Prisma.sql`SELECT * FROM "EquipmentEvent" WHERE "organizationId"=${organizationId}::uuid AND "equipmentId"=${equipmentId}::uuid ORDER BY "occurredAt" DESC,"createdAt" DESC`);}
  async addEvent(input:Parameters<EquipmentStore["addEvent"]>[0]){
    return db.$transaction(async tx=>{
      const equipment=(await tx.$queryRaw<EquipmentRecord[]>(Prisma.sql`SELECT * FROM "Equipment" WHERE "organizationId"=${input.organizationId}::uuid AND "id"=${input.equipmentId}::uuid FOR UPDATE`))[0];
      if(!equipment)throw new EquipmentValidationError("Equipment not found"); if(equipment.status==="RETIRED")throw new EquipmentValidationError("Retired equipment cannot receive new operational events");
      if(input.performedByUserId){const performer=await tx.user.findFirst({where:{organizationId:input.organizationId,id:input.performedByUserId,status:"ACTIVE"},select:{id:true}});if(!performer)throw new Error("Access denied");}
      if(input.evidenceFileId){const file=await tx.fileObject.findFirst({where:{organizationId:input.organizationId,id:input.evidenceFileId,status:"AVAILABLE"},select:{id:true}});if(!file)throw new Error("Access denied");}
      const rows=await tx.$queryRaw<EquipmentEventRecord[]>(Prisma.sql`INSERT INTO "EquipmentEvent" ("organizationId","equipmentId","eventType","occurredAt","summary","evidenceFileId","performedByUserId","createdByUserId") VALUES (${input.organizationId}::uuid,${input.equipmentId}::uuid,${input.eventType}::"EquipmentEventType",${input.occurredAt},${input.summary},${input.evidenceFileId}::uuid,${input.performedByUserId}::uuid,${input.actorUserId}::uuid) RETURNING *`);
      const event=rows[0];if(!event)throw new EquipmentValidationError("Equipment event could not be recorded");
      await tx.auditEvent.create({data:{organizationId:input.organizationId,actorUserId:input.actorUserId,action:"EQUIPMENT_EVENT_RECORDED",entityType:"Equipment",entityId:input.equipmentId,metadata:{equipmentNumber:equipment.equipmentNumber,eventId:event.id,eventType:event.eventType,occurredAt:event.occurredAt.toISOString(),evidenceFileId:event.evidenceFileId}}});return event;
    });
  }
}
