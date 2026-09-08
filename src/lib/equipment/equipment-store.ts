import { Prisma } from "@prisma/client";
import { db } from "../db";
import { EquipmentValidationError,type EquipmentEventRecord,type EquipmentRecord,type EquipmentStatus,type EquipmentStore } from "./equipment";

const allowedTransitions:Record<EquipmentStatus,readonly EquipmentStatus[]>={PLANNED:["ACTIVE","RETIRED"],ACTIVE:["OUT_OF_SERVICE","RETIRED"],OUT_OF_SERVICE:["ACTIVE","RETIRED"],RETIRED:[]};

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
      if(!equipment)throw new EquipmentValidationError("Equipment not found");
      if(equipment.status==="RETIRED")throw new EquipmentValidationError("Retired equipment cannot receive new operational events");
      if(["OUT_OF_SERVICE","RETURNED_TO_SERVICE","RETIRED"].includes(input.eventType))throw new EquipmentValidationError("Equipment lifecycle events must use the governed status transition workflow");
      if(input.eventType==="QUALIFIED"&&!input.evidenceFileId)throw new EquipmentValidationError("Qualification requires governed evidence");
      if(input.performedByUserId){const performer=await tx.user.findFirst({where:{organizationId:input.organizationId,id:input.performedByUserId,status:"ACTIVE"},select:{id:true}});if(!performer)throw new Error("Access denied");}
      if(input.evidenceFileId){const file=await tx.fileObject.findFirst({where:{organizationId:input.organizationId,id:input.evidenceFileId,status:"AVAILABLE"},select:{id:true}});if(!file)throw new Error("Access denied");}
      const rows=await tx.$queryRaw<EquipmentEventRecord[]>(Prisma.sql`INSERT INTO "EquipmentEvent" ("organizationId","equipmentId","eventType","occurredAt","summary","evidenceFileId","performedByUserId","createdByUserId") VALUES (${input.organizationId}::uuid,${input.equipmentId}::uuid,${input.eventType}::"EquipmentEventType",${input.occurredAt},${input.summary},${input.evidenceFileId}::uuid,${input.performedByUserId}::uuid,${input.actorUserId}::uuid) RETURNING *`);
      const event=rows[0];if(!event)throw new EquipmentValidationError("Equipment event could not be recorded");
      if(input.eventType==="CALIBRATED"&&equipment.calibrationRequired&&equipment.calibrationIntervalDays){await tx.$executeRaw(Prisma.sql`UPDATE "Equipment" SET "nextCalibrationDueAt"=(${input.occurredAt}::timestamptz::date + (${equipment.calibrationIntervalDays} * INTERVAL '1 day'))::date,"updatedAt"=CURRENT_TIMESTAMP WHERE "organizationId"=${input.organizationId}::uuid AND "id"=${input.equipmentId}::uuid`);}
      if(input.eventType==="MAINTENANCE"&&equipment.maintenanceRequired&&equipment.maintenanceIntervalDays){await tx.$executeRaw(Prisma.sql`UPDATE "Equipment" SET "nextMaintenanceDueAt"=(${input.occurredAt}::timestamptz::date + (${equipment.maintenanceIntervalDays} * INTERVAL '1 day'))::date,"updatedAt"=CURRENT_TIMESTAMP WHERE "organizationId"=${input.organizationId}::uuid AND "id"=${input.equipmentId}::uuid`);}
      if(input.eventType==="QUALIFIED"){
        if(equipment.calibrationRequired&&equipment.calibrationIntervalDays&&!equipment.nextCalibrationDueAt)await tx.$executeRaw(Prisma.sql`UPDATE "Equipment" SET "nextCalibrationDueAt"=(${input.occurredAt}::timestamptz::date + (${equipment.calibrationIntervalDays} * INTERVAL '1 day'))::date,"updatedAt"=CURRENT_TIMESTAMP WHERE "organizationId"=${input.organizationId}::uuid AND "id"=${input.equipmentId}::uuid`);
        if(equipment.maintenanceRequired&&equipment.maintenanceIntervalDays&&!equipment.nextMaintenanceDueAt)await tx.$executeRaw(Prisma.sql`UPDATE "Equipment" SET "nextMaintenanceDueAt"=(${input.occurredAt}::timestamptz::date + (${equipment.maintenanceIntervalDays} * INTERVAL '1 day'))::date,"updatedAt"=CURRENT_TIMESTAMP WHERE "organizationId"=${input.organizationId}::uuid AND "id"=${input.equipmentId}::uuid`);
      }
      await tx.auditEvent.create({data:{organizationId:input.organizationId,actorUserId:input.actorUserId,action:"EQUIPMENT_EVENT_RECORDED",entityType:"Equipment",entityId:input.equipmentId,metadata:{equipmentNumber:equipment.equipmentNumber,eventId:event.id,eventType:event.eventType,occurredAt:event.occurredAt.toISOString(),evidenceFileId:event.evidenceFileId}}});return event;
    });
  }
  async transition(input:Parameters<EquipmentStore["transition"]>[0]){
    return db.$transaction(async tx=>{
      const equipment=(await tx.$queryRaw<EquipmentRecord[]>(Prisma.sql`SELECT * FROM "Equipment" WHERE "organizationId"=${input.organizationId}::uuid AND "id"=${input.equipmentId}::uuid FOR UPDATE`))[0];
      if(!equipment)throw new EquipmentValidationError("Equipment not found");
      if(!allowedTransitions[equipment.status].includes(input.status))throw new EquipmentValidationError(`Invalid equipment status transition from ${equipment.status}`);
      if(input.status==="ACTIVE"){
        const qualified=(await tx.$queryRaw<Array<{ok:boolean}>>(Prisma.sql`SELECT EXISTS(SELECT 1 FROM "EquipmentEvent" WHERE "organizationId"=${input.organizationId}::uuid AND "equipmentId"=${input.equipmentId}::uuid AND "eventType"='QUALIFIED' AND "evidenceFileId" IS NOT NULL) AS "ok"`))[0]?.ok;
        if(!qualified)throw new EquipmentValidationError("Equipment cannot be activated until qualification evidence is recorded");
        const latest=(await tx.$queryRaw<EquipmentRecord[]>(Prisma.sql`SELECT * FROM "Equipment" WHERE "organizationId"=${input.organizationId}::uuid AND "id"=${input.equipmentId}::uuid`))[0];
        if(latest?.calibrationRequired&&(!latest.nextCalibrationDueAt||latest.nextCalibrationDueAt<new Date(new Date().toISOString().slice(0,10))))throw new EquipmentValidationError("Equipment cannot be activated with missing or overdue calibration");
        if(latest?.maintenanceRequired&&(!latest.nextMaintenanceDueAt||latest.nextMaintenanceDueAt<new Date(new Date().toISOString().slice(0,10))))throw new EquipmentValidationError("Equipment cannot be activated with missing or overdue maintenance");
      }
      const updated=(await tx.$queryRaw<EquipmentRecord[]>(Prisma.sql`UPDATE "Equipment" SET "status"=${input.status}::"EquipmentStatus","placedInServiceAt"=CASE WHEN ${input.status}::"EquipmentStatus"='ACTIVE' AND "placedInServiceAt" IS NULL THEN CURRENT_DATE ELSE "placedInServiceAt" END,"updatedAt"=CURRENT_TIMESTAMP WHERE "organizationId"=${input.organizationId}::uuid AND "id"=${input.equipmentId}::uuid RETURNING *`))[0];
      if(!updated)throw new EquipmentValidationError("Equipment status could not be updated");
      await tx.$executeRaw(Prisma.sql`INSERT INTO "EquipmentStatusChange" ("organizationId","equipmentId","fromStatus","toStatus","reason","actorUserId") VALUES (${input.organizationId}::uuid,${input.equipmentId}::uuid,${equipment.status}::"EquipmentStatus",${input.status}::"EquipmentStatus",${input.reason},${input.actorUserId}::uuid)`);
      const eventType=input.status==="OUT_OF_SERVICE"?"OUT_OF_SERVICE":input.status==="RETIRED"?"RETIRED":equipment.status==="OUT_OF_SERVICE"&&input.status==="ACTIVE"?"RETURNED_TO_SERVICE":null;
      if(eventType)await tx.$executeRaw(Prisma.sql`INSERT INTO "EquipmentEvent" ("organizationId","equipmentId","eventType","occurredAt","summary","performedByUserId","createdByUserId") VALUES (${input.organizationId}::uuid,${input.equipmentId}::uuid,${eventType}::"EquipmentEventType",CURRENT_TIMESTAMP,${input.reason},${input.actorUserId}::uuid,${input.actorUserId}::uuid)`);
      await tx.auditEvent.create({data:{organizationId:input.organizationId,actorUserId:input.actorUserId,action:"EQUIPMENT_STATUS_CHANGED",entityType:"Equipment",entityId:input.equipmentId,reason:input.reason,metadata:{equipmentNumber:equipment.equipmentNumber,fromStatus:equipment.status,toStatus:input.status}}});
      return updated;
    });
  }
}
