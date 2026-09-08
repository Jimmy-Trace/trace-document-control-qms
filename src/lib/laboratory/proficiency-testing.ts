import { Prisma } from "@prisma/client";
import type { AuthorizationContext } from "../security/authorization";
import { requireAuthorization } from "../security/authorization";
import { db } from "../db";

export class ProficiencyTestingError extends Error {}

type EventStatus="SCHEDULED"|"OPEN"|"SUBMITTED"|"SCORED"|"CLOSED"|"CANCELLED";

export class ProficiencyTestingService {
  async list(context:AuthorizationContext,organizationId:string){
    requireAuthorization(context,{organizationId,permission:"lab_test.read"});
    return db.$queryRaw(Prisma.sql`
      SELECT p.id,p."programCode",p."providerName",p.status,p."laboratoryTestId",p."laboratoryMethodId",
        COALESCE(json_agg(json_build_object('id',e.id,'eventCode',e."eventCode",'status',e.status,'dueAt',e."dueAt",'laboratoryMethodVersionId',e."laboratoryMethodVersionId") ORDER BY e."createdAt" DESC) FILTER (WHERE e.id IS NOT NULL),'[]'::json) AS events
      FROM "ProficiencyTestingProgram" p
      LEFT JOIN "ProficiencyTestingEvent" e ON e."organizationId"=p."organizationId" AND e."proficiencyTestingProgramId"=p.id
      WHERE p."organizationId"=${organizationId}::uuid
      GROUP BY p.id ORDER BY p."createdAt" DESC`);
  }

  async createProgram(context:AuthorizationContext,input:{organizationId:string;programCode:string;providerName:string;laboratoryTestId:string;laboratoryMethodId:string}){
    requireAuthorization(context,{organizationId:input.organizationId,permission:"lab_test.manage"});
    const programCode=input.programCode.trim(),providerName=input.providerName.trim();
    if(!programCode||!providerName)throw new ProficiencyTestingError("Program code and provider name are required");
    return db.$transaction(async tx=>{
      const method=(await tx.$queryRaw<Array<{laboratoryTestId:string;status:string}>>(Prisma.sql`SELECT "laboratoryTestId",status FROM "LaboratoryMethod" WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.laboratoryMethodId}::uuid`))[0];
      if(!method||method.laboratoryTestId!==input.laboratoryTestId||method.status==="RETIRED")throw new ProficiencyTestingError("Selected method must belong to the selected test and not be retired");
      const row=(await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`INSERT INTO "ProficiencyTestingProgram" ("organizationId","programCode","providerName","laboratoryTestId","laboratoryMethodId","createdByUserId") VALUES (${input.organizationId}::uuid,${programCode},${providerName},${input.laboratoryTestId}::uuid,${input.laboratoryMethodId}::uuid,${context.userId}::uuid) RETURNING id`))[0];
      if(!row)throw new ProficiencyTestingError("PT program could not be created");
      await tx.auditEvent.create({data:{organizationId:input.organizationId,actorUserId:context.userId,action:"PT_PROGRAM_CREATED",entityType:"ProficiencyTestingProgram",entityId:row.id,metadata:{programCode,providerName,laboratoryTestId:input.laboratoryTestId,laboratoryMethodId:input.laboratoryMethodId}}});
      return row;
    });
  }

  async createEvent(context:AuthorizationContext,input:{organizationId:string;proficiencyTestingProgramId:string;eventCode:string;laboratoryMethodVersionId:string;dueAt?:string|null}){
    requireAuthorization(context,{organizationId:input.organizationId,permission:"lab_test.manage"});
    const eventCode=input.eventCode.trim(); if(!eventCode)throw new ProficiencyTestingError("Event code is required");
    return db.$transaction(async tx=>{
      const program=(await tx.$queryRaw<Array<{status:string;laboratoryMethodId:string}>>(Prisma.sql`SELECT status,"laboratoryMethodId" FROM "ProficiencyTestingProgram" WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.proficiencyTestingProgramId}::uuid`))[0];
      if(!program||program.status!=="ACTIVE")throw new ProficiencyTestingError("PT program must be ACTIVE");
      const version=(await tx.$queryRaw<Array<{laboratoryMethodId:string}>>(Prisma.sql`SELECT "laboratoryMethodId" FROM "LaboratoryMethodVersion" WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.laboratoryMethodVersionId}::uuid`))[0];
      if(!version||version.laboratoryMethodId!==program.laboratoryMethodId)throw new ProficiencyTestingError("Method version must belong to the PT program method");
      const row=(await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`INSERT INTO "ProficiencyTestingEvent" ("organizationId","proficiencyTestingProgramId","eventCode","laboratoryMethodVersionId","dueAt","createdByUserId") VALUES (${input.organizationId}::uuid,${input.proficiencyTestingProgramId}::uuid,${eventCode},${input.laboratoryMethodVersionId}::uuid,${input.dueAt?new Date(input.dueAt):null},${context.userId}::uuid) RETURNING id`))[0];
      if(!row)throw new ProficiencyTestingError("PT event could not be created");
      await tx.auditEvent.create({data:{organizationId:input.organizationId,actorUserId:context.userId,action:"PT_EVENT_CREATED",entityType:"ProficiencyTestingEvent",entityId:row.id,metadata:{eventCode,proficiencyTestingProgramId:input.proficiencyTestingProgramId,laboratoryMethodVersionId:input.laboratoryMethodVersionId}}});
      return row;
    });
  }

  async transitionEvent(context:AuthorizationContext,input:{organizationId:string;proficiencyTestingEventId:string;toStatus:"OPEN"|"CANCELLED"|"CLOSED";reason:string}){
    requireAuthorization(context,{organizationId:input.organizationId,permission:"lab_test.manage"});
    const reason=input.reason.trim(); if(!reason)throw new ProficiencyTestingError("Transition reason is required");
    return db.$transaction(async tx=>{
      const current=(await tx.$queryRaw<Array<{status:EventStatus}>>(Prisma.sql`SELECT status FROM "ProficiencyTestingEvent" WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.proficiencyTestingEventId}::uuid FOR UPDATE`))[0];
      if(!current)throw new ProficiencyTestingError("PT event not found");
      const ts=input.toStatus==="OPEN"?Prisma.sql`,"openedAt"=COALESCE("openedAt",CURRENT_TIMESTAMP)`:input.toStatus==="CLOSED"?Prisma.sql`,"closedAt"=CURRENT_TIMESTAMP`:Prisma.empty;
      await tx.$executeRaw(Prisma.sql`UPDATE "ProficiencyTestingEvent" SET status=${input.toStatus}::"ProficiencyTestingEventStatus","updatedAt"=CURRENT_TIMESTAMP ${ts} WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.proficiencyTestingEventId}::uuid`);
      await tx.$executeRaw(Prisma.sql`INSERT INTO "ProficiencyTestingEventAction" ("organizationId","proficiencyTestingEventId","fromStatus","toStatus",reason,"actorUserId") VALUES (${input.organizationId}::uuid,${input.proficiencyTestingEventId}::uuid,${current.status}::"ProficiencyTestingEventStatus",${input.toStatus}::"ProficiencyTestingEventStatus",${reason},${context.userId}::uuid)`);
      await tx.auditEvent.create({data:{organizationId:input.organizationId,actorUserId:context.userId,action:`PT_EVENT_${input.toStatus}`,entityType:"ProficiencyTestingEvent",entityId:input.proficiencyTestingEventId,reason,metadata:{fromStatus:current.status,toStatus:input.toStatus}}});
      return{status:input.toStatus};
    });
  }

  async submitResult(context:AuthorizationContext,input:{organizationId:string;proficiencyTestingEventId:string;reportedResult:string;evidenceFileId?:string|null;reason:string}){
    requireAuthorization(context,{organizationId:input.organizationId,permission:"lab_test.manage"});
    const reportedResult=input.reportedResult.trim(),reason=input.reason.trim(); if(!reportedResult||!reason)throw new ProficiencyTestingError("Reported result and submission reason are required");
    return db.$transaction(async tx=>{
      const current=(await tx.$queryRaw<Array<{status:EventStatus}>>(Prisma.sql`SELECT status FROM "ProficiencyTestingEvent" WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.proficiencyTestingEventId}::uuid FOR UPDATE`))[0];
      if(!current||current.status!=="OPEN")throw new ProficiencyTestingError("PT results may only be submitted while event is OPEN");
      const submission=(await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`INSERT INTO "ProficiencyTestingSubmission" ("organizationId","proficiencyTestingEventId","reportedResult","evidenceFileId","submittedByUserId") VALUES (${input.organizationId}::uuid,${input.proficiencyTestingEventId}::uuid,${reportedResult},${input.evidenceFileId??null}::uuid,${context.userId}::uuid) RETURNING id`))[0];
      await tx.$executeRaw(Prisma.sql`UPDATE "ProficiencyTestingEvent" SET status='SUBMITTED',"submittedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.proficiencyTestingEventId}::uuid`);
      await tx.$executeRaw(Prisma.sql`INSERT INTO "ProficiencyTestingEventAction" ("organizationId","proficiencyTestingEventId","fromStatus","toStatus",reason,"actorUserId") VALUES (${input.organizationId}::uuid,${input.proficiencyTestingEventId}::uuid,'OPEN','SUBMITTED',${reason},${context.userId}::uuid)`);
      await tx.auditEvent.create({data:{organizationId:input.organizationId,actorUserId:context.userId,action:"PT_RESULT_SUBMITTED",entityType:"ProficiencyTestingEvent",entityId:input.proficiencyTestingEventId,reason,metadata:{submissionId:submission?.id??null,evidenceFileId:input.evidenceFileId??null}}});
      return submission;
    });
  }

  async scoreEvent(context:AuthorizationContext,input:{organizationId:string;proficiencyTestingEventId:string;outcome:"SATISFACTORY"|"UNSATISFACTORY";scoreSummary:string;evidenceFileId?:string|null;reason:string}){
    requireAuthorization(context,{organizationId:input.organizationId,permission:"lab_test.manage"});
    const scoreSummary=input.scoreSummary.trim(),reason=input.reason.trim(); if(!scoreSummary||!reason)throw new ProficiencyTestingError("Score summary and scoring reason are required");
    return db.$transaction(async tx=>{
      const current=(await tx.$queryRaw<Array<{status:EventStatus}>>(Prisma.sql`SELECT status FROM "ProficiencyTestingEvent" WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.proficiencyTestingEventId}::uuid FOR UPDATE`))[0];
      if(!current||current.status!=="SUBMITTED")throw new ProficiencyTestingError("PT event may only be scored after submission");
      const score=(await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`INSERT INTO "ProficiencyTestingScore" ("organizationId","proficiencyTestingEventId",outcome,"scoreSummary","evidenceFileId","scoredByUserId") VALUES (${input.organizationId}::uuid,${input.proficiencyTestingEventId}::uuid,${input.outcome}::"ProficiencyTestingOutcome",${scoreSummary},${input.evidenceFileId??null}::uuid,${context.userId}::uuid) RETURNING id`))[0];
      await tx.$executeRaw(Prisma.sql`UPDATE "ProficiencyTestingEvent" SET status='SCORED',"scoredAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.proficiencyTestingEventId}::uuid`);
      await tx.$executeRaw(Prisma.sql`INSERT INTO "ProficiencyTestingEventAction" ("organizationId","proficiencyTestingEventId","fromStatus","toStatus",reason,"actorUserId") VALUES (${input.organizationId}::uuid,${input.proficiencyTestingEventId}::uuid,'SUBMITTED','SCORED',${reason},${context.userId}::uuid)`);
      await tx.auditEvent.create({data:{organizationId:input.organizationId,actorUserId:context.userId,action:"PT_EVENT_SCORED",entityType:"ProficiencyTestingEvent",entityId:input.proficiencyTestingEventId,reason,metadata:{scoreId:score?.id??null,outcome:input.outcome,evidenceFileId:input.evidenceFileId??null}}});
      return score;
    });
  }

  async addFollowUp(context:AuthorizationContext,input:{organizationId:string;proficiencyTestingEventId:string;description:string;evidenceFileId?:string|null}){
    requireAuthorization(context,{organizationId:input.organizationId,permission:"lab_test.manage"});
    const description=input.description.trim(); if(!description)throw new ProficiencyTestingError("Follow-up description is required");
    return db.$transaction(async tx=>{
      const event=(await tx.$queryRaw<Array<{status:EventStatus}>>(Prisma.sql`SELECT status FROM "ProficiencyTestingEvent" WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.proficiencyTestingEventId}::uuid`))[0];
      if(!event||event.status!=="SCORED")throw new ProficiencyTestingError("Follow-up may only be recorded for a SCORED event");
      const row=(await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`INSERT INTO "ProficiencyTestingFollowUp" ("organizationId","proficiencyTestingEventId",description,"evidenceFileId","recordedByUserId") VALUES (${input.organizationId}::uuid,${input.proficiencyTestingEventId}::uuid,${description},${input.evidenceFileId??null}::uuid,${context.userId}::uuid) RETURNING id`))[0];
      await tx.auditEvent.create({data:{organizationId:input.organizationId,actorUserId:context.userId,action:"PT_FOLLOW_UP_RECORDED",entityType:"ProficiencyTestingEvent",entityId:input.proficiencyTestingEventId,metadata:{followUpId:row?.id??null,evidenceFileId:input.evidenceFileId??null}}});
      return row;
    });
  }
}
