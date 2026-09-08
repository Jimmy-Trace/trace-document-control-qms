import { Prisma } from "@prisma/client";
import type { AuthorizationContext } from "../security/authorization";
import { requireAuthorization } from "../security/authorization";
import { db } from "../db";
import { QmsNotificationRouter } from "../notifications/qms-router";

export class LaboratoryValidationError extends Error {}

const notificationRouter=new QmsNotificationRouter();

export class LaboratoryValidationService {
  async createProject(context:AuthorizationContext,input:{organizationId:string;projectNumber:string;laboratoryMethodId:string;laboratoryMethodVersionId:string;title:string;objective:string}){
    requireAuthorization(context,{organizationId:input.organizationId,permission:"lab_test.manage"});
    const projectNumber=input.projectNumber.trim(),title=input.title.trim(),objective=input.objective.trim();
    if(!projectNumber||!title||!objective)throw new LaboratoryValidationError("Project number, title, and objective are required");
    return db.$transaction(async tx=>{
      const method=(await tx.$queryRaw<Array<{id:string;status:string}>>(Prisma.sql`SELECT id,status FROM "LaboratoryMethod" WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.laboratoryMethodId}::uuid`))[0];
      if(!method||method.status==="RETIRED")throw new LaboratoryValidationError("Laboratory method not found or retired");
      const version=(await tx.$queryRaw<Array<{id:string;laboratoryMethodId:string}>>(Prisma.sql`SELECT id,"laboratoryMethodId" FROM "LaboratoryMethodVersion" WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.laboratoryMethodVersionId}::uuid`))[0];
      if(!version||version.laboratoryMethodId!==input.laboratoryMethodId)throw new LaboratoryValidationError("Method version does not belong to selected method");
      const row=(await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`INSERT INTO "ValidationProject" ("organizationId","projectNumber","laboratoryMethodId","laboratoryMethodVersionId",title,objective,"createdByUserId") VALUES (${input.organizationId}::uuid,${projectNumber},${input.laboratoryMethodId}::uuid,${input.laboratoryMethodVersionId}::uuid,${title},${objective},${context.userId}::uuid) RETURNING id`))[0];
      if(!row)throw new LaboratoryValidationError("Validation project could not be created");
      await tx.auditEvent.create({data:{organizationId:input.organizationId,actorUserId:context.userId,action:"VALIDATION_PROJECT_CREATED",entityType:"ValidationProject",entityId:row.id,metadata:{projectNumber,laboratoryMethodId:input.laboratoryMethodId,laboratoryMethodVersionId:input.laboratoryMethodVersionId}}});
      await notificationRouter.publishConfigured(tx,{organizationId:input.organizationId,topicKey:"laboratory.validation.project.created",eventKey:`validation-project:${row.id}:created`,payload:{validationProjectId:row.id,projectNumber,laboratoryMethodId:input.laboratoryMethodId,laboratoryMethodVersionId:input.laboratoryMethodVersionId}});
      return row;
    });
  }

  async addCriterion(context:AuthorizationContext,input:{organizationId:string;validationProjectId:string;criterionCode:string;description:string;acceptanceRule:string}){
    requireAuthorization(context,{organizationId:input.organizationId,permission:"lab_test.manage"});
    const criterionCode=input.criterionCode.trim(),description=input.description.trim(),acceptanceRule=input.acceptanceRule.trim();
    if(!criterionCode||!description||!acceptanceRule)throw new LaboratoryValidationError("Criterion code, description, and acceptance rule are required");
    return db.$transaction(async tx=>{
      const project=(await tx.$queryRaw<Array<{status:string}>>(Prisma.sql`SELECT status FROM "ValidationProject" WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.validationProjectId}::uuid FOR UPDATE`))[0];
      if(!project||project.status!=="DRAFT")throw new LaboratoryValidationError("Criteria may only be added while validation project is DRAFT");
      const row=(await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`INSERT INTO "ValidationCriterion" ("organizationId","validationProjectId","criterionCode",description,"acceptanceRule") VALUES (${input.organizationId}::uuid,${input.validationProjectId}::uuid,${criterionCode},${description},${acceptanceRule}) RETURNING id`))[0];
      if(!row)throw new LaboratoryValidationError("Validation criterion could not be created");
      await tx.auditEvent.create({data:{organizationId:input.organizationId,actorUserId:context.userId,action:"VALIDATION_CRITERION_CREATED",entityType:"ValidationProject",entityId:input.validationProjectId,metadata:{criterionId:row.id,criterionCode}}});
      return row;
    });
  }

  async transitionProject(context:AuthorizationContext,input:{organizationId:string;validationProjectId:string;toStatus:"IN_PROGRESS"|"COMPLETED"|"CANCELLED";reason:string}){
    requireAuthorization(context,{organizationId:input.organizationId,permission:"lab_test.manage"});
    const reason=input.reason.trim(); if(!reason)throw new LaboratoryValidationError("Transition reason is required");
    return db.$transaction(async tx=>{
      const current=(await tx.$queryRaw<Array<{status:"DRAFT"|"IN_PROGRESS"|"COMPLETED"|"CANCELLED"}>>(Prisma.sql`SELECT status FROM "ValidationProject" WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.validationProjectId}::uuid FOR UPDATE`))[0];
      if(!current)throw new LaboratoryValidationError("Validation project not found");
      const nowColumn=input.toStatus==="IN_PROGRESS"?Prisma.sql`,"startedAt"=COALESCE("startedAt",CURRENT_TIMESTAMP)`:input.toStatus==="COMPLETED"?Prisma.sql`,"completedAt"=CURRENT_TIMESTAMP`:Prisma.empty;
      await tx.$executeRaw(Prisma.sql`UPDATE "ValidationProject" SET status=${input.toStatus}::"ValidationProjectStatus","updatedAt"=CURRENT_TIMESTAMP ${nowColumn} WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.validationProjectId}::uuid`);
      await tx.$executeRaw(Prisma.sql`INSERT INTO "ValidationProjectActionEvent" ("organizationId","validationProjectId",action,"fromStatus","toStatus",reason,"actorUserId") VALUES (${input.organizationId}::uuid,${input.validationProjectId}::uuid,${input.toStatus},${current.status}::"ValidationProjectStatus",${input.toStatus}::"ValidationProjectStatus",${reason},${context.userId}::uuid)`);
      await tx.auditEvent.create({data:{organizationId:input.organizationId,actorUserId:context.userId,action:`VALIDATION_PROJECT_${input.toStatus}`,entityType:"ValidationProject",entityId:input.validationProjectId,reason,metadata:{fromStatus:current.status,toStatus:input.toStatus}}});
      await notificationRouter.publishConfigured(tx,{organizationId:input.organizationId,topicKey:"laboratory.validation.project.status",eventKey:`validation-project:${input.validationProjectId}:status:${input.toStatus}`,payload:{validationProjectId:input.validationProjectId,fromStatus:current.status,toStatus:input.toStatus,reason}});
      return{status:input.toStatus};
    });
  }

  async recordResult(context:AuthorizationContext,input:{organizationId:string;validationProjectId:string;validationCriterionId:string;outcome:"PASS"|"FAIL";observedResult:string;evidenceFileId?:string|null}){
    requireAuthorization(context,{organizationId:input.organizationId,permission:"lab_test.manage"});
    const observedResult=input.observedResult.trim(); if(!observedResult)throw new LaboratoryValidationError("Observed result is required");
    return db.$transaction(async tx=>{
      const project=(await tx.$queryRaw<Array<{status:string}>>(Prisma.sql`SELECT status FROM "ValidationProject" WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.validationProjectId}::uuid FOR UPDATE`))[0];
      if(!project||project.status!=="IN_PROGRESS")throw new LaboratoryValidationError("Results may only be recorded while validation project is IN_PROGRESS");
      const row=(await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`INSERT INTO "ValidationResult" ("organizationId","validationProjectId","validationCriterionId",outcome,"observedResult","evidenceFileId","recordedByUserId") VALUES (${input.organizationId}::uuid,${input.validationProjectId}::uuid,${input.validationCriterionId}::uuid,${input.outcome}::"ValidationResultOutcome",${observedResult},${input.evidenceFileId??null}::uuid,${context.userId}::uuid) RETURNING id`))[0];
      if(!row)throw new LaboratoryValidationError("Validation result could not be recorded");
      await tx.auditEvent.create({data:{organizationId:input.organizationId,actorUserId:context.userId,action:"VALIDATION_RESULT_RECORDED",entityType:"ValidationProject",entityId:input.validationProjectId,metadata:{validationResultId:row.id,validationCriterionId:input.validationCriterionId,outcome:input.outcome,evidenceFileId:input.evidenceFileId??null}}});
      await notificationRouter.publishConfigured(tx,{organizationId:input.organizationId,topicKey:"laboratory.validation.result.recorded",eventKey:`validation-result:${row.id}:recorded`,payload:{validationProjectId:input.validationProjectId,validationResultId:row.id,validationCriterionId:input.validationCriterionId,outcome:input.outcome}});
      return row;
    });
  }

  async activateValidatedMethod(context:AuthorizationContext,input:{organizationId:string;laboratoryMethodId:string;reason:string}){
    requireAuthorization(context,{organizationId:input.organizationId,permission:"lab_test.manage"});
    const reason=input.reason.trim(); if(!reason)throw new LaboratoryValidationError("Activation reason is required");
    return db.$transaction(async tx=>{
      const method=(await tx.$queryRaw<Array<{status:"DRAFT"|"ACTIVE"|"RETIRED";laboratoryTestId:string}>>(Prisma.sql`SELECT status,"laboratoryTestId" FROM "LaboratoryMethod" WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.laboratoryMethodId}::uuid FOR UPDATE`))[0];
      if(!method||method.status!=="DRAFT")throw new LaboratoryValidationError("Only DRAFT methods may be activated");
      await tx.$executeRaw(Prisma.sql`UPDATE "LaboratoryMethod" SET status='ACTIVE',"updatedAt"=CURRENT_TIMESTAMP WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.laboratoryMethodId}::uuid`);
      await tx.$executeRaw(Prisma.sql`INSERT INTO "LaboratoryMethodStatusChange" ("organizationId","laboratoryMethodId","fromStatus","toStatus",reason,"actorUserId") VALUES (${input.organizationId}::uuid,${input.laboratoryMethodId}::uuid,'DRAFT','ACTIVE',${reason},${context.userId}::uuid)`);
      const test=(await tx.$queryRaw<Array<{status:string}>>(Prisma.sql`SELECT status FROM "LaboratoryTest" WHERE "organizationId"=${input.organizationId}::uuid AND id=${method.laboratoryTestId}::uuid FOR UPDATE`))[0];
      if(test?.status==="DRAFT"){
        await tx.$executeRaw(Prisma.sql`UPDATE "LaboratoryTest" SET status='ACTIVE',"updatedAt"=CURRENT_TIMESTAMP WHERE "organizationId"=${input.organizationId}::uuid AND id=${method.laboratoryTestId}::uuid`);
        await tx.$executeRaw(Prisma.sql`INSERT INTO "LaboratoryTestStatusChange" ("organizationId","laboratoryTestId","fromStatus","toStatus",reason,"actorUserId") VALUES (${input.organizationId}::uuid,${method.laboratoryTestId}::uuid,'DRAFT','ACTIVE',${reason},${context.userId}::uuid)`);
      }
      await tx.auditEvent.create({data:{organizationId:input.organizationId,actorUserId:context.userId,action:"LABORATORY_METHOD_ACTIVATED",entityType:"LaboratoryMethod",entityId:input.laboratoryMethodId,reason,metadata:{laboratoryTestId:method.laboratoryTestId}}});
      await notificationRouter.publishConfigured(tx,{organizationId:input.organizationId,topicKey:"laboratory.method.activated",eventKey:`laboratory-method:${input.laboratoryMethodId}:activated`,payload:{laboratoryMethodId:input.laboratoryMethodId,laboratoryTestId:method.laboratoryTestId,reason}});
      return{methodStatus:"ACTIVE" as const,testStatus:"ACTIVE" as const};
    });
  }
}
