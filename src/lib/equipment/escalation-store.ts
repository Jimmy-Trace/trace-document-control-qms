import { Prisma } from "@prisma/client";
import { db } from "../db";
import { equipmentEscalationLevels } from "./escalation";

type Subject={organizationId:string;equipmentId:string;equipmentNumber:string;subjectType:"COMPLIANCE_HOLD"|"RECALL";subjectId:string;ageDays:number};

export class PrismaEquipmentEscalationStore{
  async notifyAll(now:Date){
    const rows=await db.$queryRaw<Subject[]>(Prisma.sql`
      SELECT h."organizationId",h."equipmentId",e."equipmentNumber",'COMPLIANCE_HOLD'::text AS "subjectType",h.id AS "subjectId",
        GREATEST(1,FLOOR(EXTRACT(EPOCH FROM (${now}::timestamptz-h."dueAt"::timestamptz))/86400))::int AS "ageDays"
      FROM "EquipmentComplianceHold" h JOIN "Equipment" e ON e."organizationId"=h."organizationId" AND e.id=h."equipmentId"
      WHERE h."clearedAt" IS NULL AND h."dueAt"<${now}::date
      UNION ALL
      SELECT r."organizationId",r."equipmentId",e."equipmentNumber",'RECALL'::text AS "subjectType",r.id AS "subjectId",
        GREATEST(1,FLOOR(EXTRACT(EPOCH FROM (${now}::timestamptz-r."openedAt"))/86400))::int AS "ageDays"
      FROM "EquipmentRecall" r JOIN "Equipment" e ON e."organizationId"=r."organizationId" AND e.id=r."equipmentId"
      WHERE r.status='OPEN' AND r."openedAt"<${now}::timestamptz
    `);
    let created=0;
    for(const subject of rows)for(const level of equipmentEscalationLevels(subject.ageDays))if(await this.escalate(subject,level,now))created++;
    return created;
  }
  private async escalate(subject:Subject,level:1|2|3,occurredAt:Date){
    return db.$transaction(async tx=>{
      const inserted=await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`
        INSERT INTO "EquipmentEscalation" ("organizationId","subjectType","subjectId","equipmentId","level","ageDays","escalatedAt")
        VALUES (${subject.organizationId}::uuid,${subject.subjectType}::"EquipmentEscalationSubject",${subject.subjectId}::uuid,${subject.equipmentId}::uuid,${level},${subject.ageDays},${occurredAt})
        ON CONFLICT ("organizationId","subjectType","subjectId","level") DO NOTHING RETURNING id`);
      if(!inserted[0])return false;
      const recipients=await tx.$queryRaw<Array<{userId:string}>>(Prisma.sql`
        SELECT DISTINCT ur."userId" FROM "UserRole" ur
        JOIN "User" u ON u."organizationId"=ur."organizationId" AND u.id=ur."userId" AND u.status='ACTIVE'
        JOIN "RolePermission" rp ON rp."roleId"=ur."roleId"
        JOIN "Permission" p ON p.id=rp."permissionId" AND p.key='equipment.manage'
        WHERE ur."organizationId"=${subject.organizationId}::uuid`);
      if(recipients.length)await tx.notificationOutbox.createMany({data:recipients.map(({userId})=>({organizationId:subject.organizationId,recipientUserId:userId,eventKey:`equipment-escalation:${subject.subjectType}:${subject.subjectId}:level:${level}`,templateKey:"EQUIPMENT_ESCALATION",payload:{equipmentId:subject.equipmentId,equipmentNumber:subject.equipmentNumber,subjectType:subject.subjectType,subjectId:subject.subjectId,level,ageDays:subject.ageDays},availableAt:occurredAt})),skipDuplicates:true});
      await tx.auditEvent.create({data:{organizationId:subject.organizationId,action:"EQUIPMENT_ESCALATED",entityType:"Equipment",entityId:subject.equipmentId,occurredAt,metadata:{subjectType:subject.subjectType,subjectId:subject.subjectId,level,ageDays:subject.ageDays,recipientCount:recipients.length}}});
      return true;
    });
  }
}
