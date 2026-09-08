import { Prisma } from "@prisma/client";
import { db } from "../db";
import type { AuthorizationContext } from "../security/authorization";
import { requireAuthorization } from "../security/authorization";
import { QmsNotificationRouter } from "../notifications/qms-router";

export class AuditAccreditationError extends Error {}
const notificationRouter=new QmsNotificationRouter();

export class AuditAccreditationService {
  async createProgram(context:AuthorizationContext,input:{organizationId:string;programCode:string;name:string;authorityName:string}){
    requireAuthorization(context,{organizationId:input.organizationId,permission:"accreditation.manage"});
    const programCode=input.programCode.trim(),name=input.name.trim(),authorityName=input.authorityName.trim();
    if(!programCode||!name||!authorityName)throw new AuditAccreditationError("Program code, name, and authority are required");
    return db.$transaction(async tx=>{
      const row=(await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`INSERT INTO "AccreditationProgram" ("organizationId","programCode",name,"authorityName","createdByUserId") VALUES (${input.organizationId}::uuid,${programCode},${name},${authorityName},${context.userId}::uuid) RETURNING id`))[0];
      if(!row)throw new AuditAccreditationError("Accreditation program could not be created");
      await tx.auditEvent.create({data:{organizationId:input.organizationId,actorUserId:context.userId,action:"ACCREDITATION_PROGRAM_CREATED",entityType:"AccreditationProgram",entityId:row.id,metadata:{programCode,authorityName}}});
      return row;
    });
  }

  async addRequirement(context:AuthorizationContext,input:{organizationId:string;accreditationProgramId:string;requirementCode:string;title:string;requirementText:string}){
    requireAuthorization(context,{organizationId:input.organizationId,permission:"accreditation.manage"});
    const requirementCode=input.requirementCode.trim(),title=input.title.trim(),requirementText=input.requirementText.trim();
    if(!requirementCode||!title||!requirementText)throw new AuditAccreditationError("Requirement code, title, and text are required");
    return db.$transaction(async tx=>{
      const program=(await tx.$queryRaw<Array<{status:string}>>(Prisma.sql`SELECT status FROM "AccreditationProgram" WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.accreditationProgramId}::uuid`))[0];
      if(!program||program.status!=="ACTIVE")throw new AuditAccreditationError("Accreditation program must be ACTIVE");
      const row=(await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`INSERT INTO "AccreditationRequirement" ("organizationId","accreditationProgramId","requirementCode",title,"requirementText","createdByUserId") VALUES (${input.organizationId}::uuid,${input.accreditationProgramId}::uuid,${requirementCode},${title},${requirementText},${context.userId}::uuid) RETURNING id`))[0];
      if(!row)throw new AuditAccreditationError("Accreditation requirement could not be created");
      await tx.auditEvent.create({data:{organizationId:input.organizationId,actorUserId:context.userId,action:"ACCREDITATION_REQUIREMENT_CREATED",entityType:"AccreditationRequirement",entityId:row.id,metadata:{accreditationProgramId:input.accreditationProgramId,requirementCode}}});
      return row;
    });
  }

  async createAudit(context:AuthorizationContext,input:{organizationId:string;auditNumber:string;title:string;scope:string;accreditationProgramId?:string|null;scheduledStartAt?:string|null}){
    requireAuthorization(context,{organizationId:input.organizationId,permission:"audit.manage"});
    const auditNumber=input.auditNumber.trim(),title=input.title.trim(),scope=input.scope.trim();
    if(!auditNumber||!title||!scope)throw new AuditAccreditationError("Audit number, title, and scope are required");
    return db.$transaction(async tx=>{
      if(input.accreditationProgramId){
        const program=(await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`SELECT id FROM "AccreditationProgram" WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.accreditationProgramId}::uuid AND status='ACTIVE'`))[0];
        if(!program)throw new AuditAccreditationError("Accreditation program not found or inactive");
      }
      const row=(await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`INSERT INTO "Audit" ("organizationId","auditNumber",title,scope,"accreditationProgramId","scheduledStartAt","createdByUserId") VALUES (${input.organizationId}::uuid,${auditNumber},${title},${scope},${input.accreditationProgramId??null}::uuid,${input.scheduledStartAt??null}::timestamptz,${context.userId}::uuid) RETURNING id`))[0];
      if(!row)throw new AuditAccreditationError("Audit could not be created");
      await tx.auditEvent.create({data:{organizationId:input.organizationId,actorUserId:context.userId,action:"AUDIT_CREATED",entityType:"Audit",entityId:row.id,metadata:{auditNumber,accreditationProgramId:input.accreditationProgramId??null}}});
      await notificationRouter.publishConfigured(tx,{organizationId:input.organizationId,topicKey:"audit.created",eventKey:`audit:${row.id}:created`,payload:{auditId:row.id,auditNumber,scheduledStartAt:input.scheduledStartAt??null}});
      return row;
    });
  }

  async addFinding(context:AuthorizationContext,input:{organizationId:string;auditId:string;findingNumber:string;severity:"OBSERVATION"|"MINOR"|"MAJOR"|"CRITICAL";description:string;requirementId?:string|null}){
    requireAuthorization(context,{organizationId:input.organizationId,permission:"audit.manage"});
    const findingNumber=input.findingNumber.trim(),description=input.description.trim();
    if(!findingNumber||!description)throw new AuditAccreditationError("Finding number and description are required");
    return db.$transaction(async tx=>{
      const audit=(await tx.$queryRaw<Array<{status:string;accreditationProgramId:string|null}>>(Prisma.sql`SELECT status,"accreditationProgramId" FROM "Audit" WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.auditId}::uuid`))[0];
      if(!audit||audit.status!=="IN_PROGRESS")throw new AuditAccreditationError("Findings may only be added while an audit is IN_PROGRESS");
      if(input.requirementId){
        const requirement=(await tx.$queryRaw<Array<{accreditationProgramId:string}>>(Prisma.sql`SELECT "accreditationProgramId" FROM "AccreditationRequirement" WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.requirementId}::uuid`))[0];
        if(!requirement||!audit.accreditationProgramId||requirement.accreditationProgramId!==audit.accreditationProgramId)throw new AuditAccreditationError("Finding requirement must belong to the audit accreditation program");
      }
      const row=(await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`INSERT INTO "AuditFinding" ("organizationId","auditId","findingNumber",severity,description,"requirementId","createdByUserId") VALUES (${input.organizationId}::uuid,${input.auditId}::uuid,${findingNumber},${input.severity}::"AuditFindingSeverity",${description},${input.requirementId??null}::uuid,${context.userId}::uuid) RETURNING id`))[0];
      if(!row)throw new AuditAccreditationError("Audit finding could not be created");
      await tx.auditEvent.create({data:{organizationId:input.organizationId,actorUserId:context.userId,action:"AUDIT_FINDING_CREATED",entityType:"AuditFinding",entityId:row.id,metadata:{auditId:input.auditId,findingNumber,severity:input.severity,requirementId:input.requirementId??null}}});
      await notificationRouter.publishConfigured(tx,{organizationId:input.organizationId,topicKey:"audit.finding.created",eventKey:`audit-finding:${row.id}:created`,payload:{auditId:input.auditId,auditFindingId:row.id,findingNumber,severity:input.severity,requirementId:input.requirementId??null}});
      return row;
    });
  }

  async transitionAudit(context:AuthorizationContext,input:{organizationId:string;auditId:string;toStatus:"IN_PROGRESS"|"COMPLETED"|"CANCELLED";reason:string}){
    requireAuthorization(context,{organizationId:input.organizationId,permission:"audit.manage"});
    const reason=input.reason.trim(); if(!reason)throw new AuditAccreditationError("Transition reason is required");
    return db.$transaction(async tx=>{
      const current=(await tx.$queryRaw<Array<{status:"PLANNED"|"IN_PROGRESS"|"COMPLETED"|"CANCELLED"}>>(Prisma.sql`SELECT status FROM "Audit" WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.auditId}::uuid FOR UPDATE`))[0];
      if(!current)throw new AuditAccreditationError("Audit not found");
      if(input.toStatus==="COMPLETED"){
        const open=(await tx.$queryRaw<Array<{count:number}>>(Prisma.sql`SELECT count(*)::integer AS count FROM "AuditFinding" WHERE "organizationId"=${input.organizationId}::uuid AND "auditId"=${input.auditId}::uuid AND status<>'CLOSED'`))[0]?.count??0;
        if(open>0)throw new AuditAccreditationError("Audit cannot complete while findings remain open");
      }
      const timestamps=input.toStatus==="IN_PROGRESS"?Prisma.sql`,"startedAt"=COALESCE("startedAt",CURRENT_TIMESTAMP)`:input.toStatus==="COMPLETED"?Prisma.sql`,"completedAt"=CURRENT_TIMESTAMP`:Prisma.empty;
      await tx.$executeRaw(Prisma.sql`UPDATE "Audit" SET status=${input.toStatus}::"AuditStatus","updatedAt"=CURRENT_TIMESTAMP ${timestamps} WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.auditId}::uuid`);
      await tx.$executeRaw(Prisma.sql`INSERT INTO "AuditStatusChange" ("organizationId","auditId","fromStatus","toStatus",reason,"actorUserId") VALUES (${input.organizationId}::uuid,${input.auditId}::uuid,${current.status}::"AuditStatus",${input.toStatus}::"AuditStatus",${reason},${context.userId}::uuid)`);
      await tx.auditEvent.create({data:{organizationId:input.organizationId,actorUserId:context.userId,action:`AUDIT_${input.toStatus}`,entityType:"Audit",entityId:input.auditId,reason,metadata:{fromStatus:current.status,toStatus:input.toStatus}}});
      await notificationRouter.publishConfigured(tx,{organizationId:input.organizationId,topicKey:"audit.lifecycle",eventKey:`audit:${input.auditId}:status:${input.toStatus}`,payload:{auditId:input.auditId,fromStatus:current.status,toStatus:input.toStatus}});
      return{status:input.toStatus};
    });
  }

  async transitionFinding(context:AuthorizationContext,input:{organizationId:string;auditFindingId:string;toStatus:"OPEN"|"UNDER_REVIEW"|"CLOSED";reason:string}){
    requireAuthorization(context,{organizationId:input.organizationId,permission:"audit.manage"});
    const reason=input.reason.trim(); if(!reason)throw new AuditAccreditationError("Transition reason is required");
    return db.$transaction(async tx=>{
      const current=(await tx.$queryRaw<Array<{status:"OPEN"|"UNDER_REVIEW"|"CLOSED"}>>(Prisma.sql`SELECT status FROM "AuditFinding" WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.auditFindingId}::uuid FOR UPDATE`))[0];
      if(!current)throw new AuditAccreditationError("Audit finding not found");
      const closed=input.toStatus==="CLOSED"?Prisma.sql`,"closedAt"=CURRENT_TIMESTAMP`:Prisma.empty;
      await tx.$executeRaw(Prisma.sql`UPDATE "AuditFinding" SET status=${input.toStatus}::"AuditFindingStatus" ${closed} WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.auditFindingId}::uuid`);
      await tx.$executeRaw(Prisma.sql`INSERT INTO "AuditFindingStatusChange" ("organizationId","auditFindingId","fromStatus","toStatus",reason,"actorUserId") VALUES (${input.organizationId}::uuid,${input.auditFindingId}::uuid,${current.status}::"AuditFindingStatus",${input.toStatus}::"AuditFindingStatus",${reason},${context.userId}::uuid)`);
      await tx.auditEvent.create({data:{organizationId:input.organizationId,actorUserId:context.userId,action:`AUDIT_FINDING_${input.toStatus}`,entityType:"AuditFinding",entityId:input.auditFindingId,reason,metadata:{fromStatus:current.status,toStatus:input.toStatus}}});
      await notificationRouter.publishConfigured(tx,{organizationId:input.organizationId,topicKey:"audit.finding.lifecycle",eventKey:`audit-finding:${input.auditFindingId}:status:${input.toStatus}`,payload:{auditFindingId:input.auditFindingId,fromStatus:current.status,toStatus:input.toStatus}});
      return{status:input.toStatus};
    });
  }
}
