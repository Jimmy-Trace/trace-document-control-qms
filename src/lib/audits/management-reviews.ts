import { Prisma } from "@prisma/client";
import { db } from "../db";
import type { AuthorizationContext } from "../security/authorization";
import { requireAuthorization } from "../security/authorization";
import { QmsNotificationRouter } from "../notifications/qms-router";

export class ManagementReviewError extends Error {}

type ReviewStatus="PLANNED"|"IN_PROGRESS"|"COMPLETED"|"CANCELLED";
type ActionStatus="OPEN"|"IN_PROGRESS"|"COMPLETED"|"CANCELLED";
type InputType="AUDIT_SUMMARY"|"QUALITY_METRICS"|"CAPA_STATUS"|"RISK_TRENDS"|"RESOURCE_NEEDS"|"CUSTOMER_FEEDBACK"|"OTHER";
const notificationRouter=new QmsNotificationRouter();

export class ManagementReviewService {
  async createReview(context:AuthorizationContext,input:{organizationId:string;reviewNumber:string;title:string;scheduledAt?:string|null}){
    requireAuthorization(context,{organizationId:input.organizationId,permission:"management_review.manage"});
    const reviewNumber=input.reviewNumber.trim(),title=input.title.trim();
    if(!reviewNumber||!title)throw new ManagementReviewError("Review number and title are required");
    return db.$transaction(async tx=>{
      const row=(await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`INSERT INTO "ManagementReview" ("organizationId","reviewNumber",title,"scheduledAt","createdByUserId") VALUES (${input.organizationId}::uuid,${reviewNumber},${title},${input.scheduledAt??null}::timestamptz,${context.userId}::uuid) RETURNING id`))[0];
      if(!row)throw new ManagementReviewError("Management review could not be created");
      await tx.auditEvent.create({data:{organizationId:input.organizationId,actorUserId:context.userId,action:"MANAGEMENT_REVIEW_CREATED",entityType:"ManagementReview",entityId:row.id,metadata:{reviewNumber}}});
      await notificationRouter.publishConfigured(tx,{organizationId:input.organizationId,topicKey:"management_review.created",eventKey:`management-review:${row.id}:created`,payload:{managementReviewId:row.id,reviewNumber,scheduledAt:input.scheduledAt??null}});
      return row;
    });
  }

  async addInput(context:AuthorizationContext,input:{organizationId:string;managementReviewId:string;inputType:InputType;summary:string;evidenceFileId?:string|null}){
    requireAuthorization(context,{organizationId:input.organizationId,permission:"management_review.manage"});
    const summary=input.summary.trim(); if(!summary)throw new ManagementReviewError("Input summary is required");
    return db.$transaction(async tx=>{
      const review=(await tx.$queryRaw<Array<{status:ReviewStatus}>>(Prisma.sql`SELECT status FROM "ManagementReview" WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.managementReviewId}::uuid`))[0];
      if(!review||!['PLANNED','IN_PROGRESS'].includes(review.status))throw new ManagementReviewError("Inputs may only be recorded before review completion");
      const row=(await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`INSERT INTO "ManagementReviewInput" ("organizationId","managementReviewId","inputType",summary,"evidenceFileId","recordedByUserId") VALUES (${input.organizationId}::uuid,${input.managementReviewId}::uuid,${input.inputType}::"ManagementReviewInputType",${summary},${input.evidenceFileId??null}::uuid,${context.userId}::uuid) RETURNING id`))[0];
      if(!row)throw new ManagementReviewError("Management review input could not be recorded");
      await tx.auditEvent.create({data:{organizationId:input.organizationId,actorUserId:context.userId,action:"MANAGEMENT_REVIEW_INPUT_RECORDED",entityType:"ManagementReview",entityId:input.managementReviewId,metadata:{inputId:row.id,inputType:input.inputType,evidenceFileId:input.evidenceFileId??null}}});
      return row;
    });
  }

  async addDecision(context:AuthorizationContext,input:{organizationId:string;managementReviewId:string;decision:string;rationale:string}){
    requireAuthorization(context,{organizationId:input.organizationId,permission:"management_review.manage"});
    const decision=input.decision.trim(),rationale=input.rationale.trim();
    if(!decision||!rationale)throw new ManagementReviewError("Decision and rationale are required");
    return db.$transaction(async tx=>{
      const review=(await tx.$queryRaw<Array<{status:ReviewStatus}>>(Prisma.sql`SELECT status FROM "ManagementReview" WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.managementReviewId}::uuid`))[0];
      if(!review||review.status!=="IN_PROGRESS")throw new ManagementReviewError("Decisions may only be recorded while review is IN_PROGRESS");
      const row=(await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`INSERT INTO "ManagementReviewDecision" ("organizationId","managementReviewId",decision,rationale,"recordedByUserId") VALUES (${input.organizationId}::uuid,${input.managementReviewId}::uuid,${decision},${rationale},${context.userId}::uuid) RETURNING id`))[0];
      if(!row)throw new ManagementReviewError("Management review decision could not be recorded");
      await tx.auditEvent.create({data:{organizationId:input.organizationId,actorUserId:context.userId,action:"MANAGEMENT_REVIEW_DECISION_RECORDED",entityType:"ManagementReview",entityId:input.managementReviewId,metadata:{decisionId:row.id}}});
      return row;
    });
  }

  async addAction(context:AuthorizationContext,input:{organizationId:string;managementReviewId:string;description:string;ownerUserId:string;dueAt?:string|null}){
    requireAuthorization(context,{organizationId:input.organizationId,permission:"management_review.manage"});
    const description=input.description.trim(); if(!description)throw new ManagementReviewError("Action description is required");
    return db.$transaction(async tx=>{
      const review=(await tx.$queryRaw<Array<{status:ReviewStatus}>>(Prisma.sql`SELECT status FROM "ManagementReview" WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.managementReviewId}::uuid`))[0];
      if(!review||review.status!=="IN_PROGRESS")throw new ManagementReviewError("Actions may only be created while review is IN_PROGRESS");
      const owner=(await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`SELECT id FROM "User" WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.ownerUserId}::uuid AND status='ACTIVE'`))[0];
      if(!owner)throw new ManagementReviewError("Action owner must be an active user in the organization");
      const row=(await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`INSERT INTO "ManagementReviewAction" ("organizationId","managementReviewId",description,"ownerUserId","dueAt","createdByUserId") VALUES (${input.organizationId}::uuid,${input.managementReviewId}::uuid,${description},${input.ownerUserId}::uuid,${input.dueAt??null}::timestamptz,${context.userId}::uuid) RETURNING id`))[0];
      if(!row)throw new ManagementReviewError("Management review action could not be created");
      await tx.auditEvent.create({data:{organizationId:input.organizationId,actorUserId:context.userId,action:"MANAGEMENT_REVIEW_ACTION_CREATED",entityType:"ManagementReviewAction",entityId:row.id,metadata:{managementReviewId:input.managementReviewId,ownerUserId:input.ownerUserId,dueAt:input.dueAt??null}}});
      await notificationRouter.publishConfigured(tx,{organizationId:input.organizationId,topicKey:"management_review.action.created",eventKey:`management-review-action:${row.id}:created`,payload:{managementReviewId:input.managementReviewId,managementReviewActionId:row.id,ownerUserId:input.ownerUserId,dueAt:input.dueAt??null}});
      return row;
    });
  }

  async transitionReview(context:AuthorizationContext,input:{organizationId:string;managementReviewId:string;toStatus:"IN_PROGRESS"|"COMPLETED"|"CANCELLED";reason:string}){
    requireAuthorization(context,{organizationId:input.organizationId,permission:"management_review.manage"});
    const reason=input.reason.trim(); if(!reason)throw new ManagementReviewError("Transition reason is required");
    return db.$transaction(async tx=>{
      const current=(await tx.$queryRaw<Array<{status:ReviewStatus}>>(Prisma.sql`SELECT status FROM "ManagementReview" WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.managementReviewId}::uuid FOR UPDATE`))[0];
      if(!current)throw new ManagementReviewError("Management review not found");
      const stamps=input.toStatus==="IN_PROGRESS"?Prisma.sql`,"startedAt"=COALESCE("startedAt",CURRENT_TIMESTAMP)`:input.toStatus==="COMPLETED"?Prisma.sql`,"completedAt"=CURRENT_TIMESTAMP`:Prisma.empty;
      await tx.$executeRaw(Prisma.sql`UPDATE "ManagementReview" SET status=${input.toStatus}::"ManagementReviewStatus","updatedAt"=CURRENT_TIMESTAMP ${stamps} WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.managementReviewId}::uuid`);
      await tx.$executeRaw(Prisma.sql`INSERT INTO "ManagementReviewStatusChange" ("organizationId","managementReviewId","fromStatus","toStatus",reason,"actorUserId") VALUES (${input.organizationId}::uuid,${input.managementReviewId}::uuid,${current.status}::"ManagementReviewStatus",${input.toStatus}::"ManagementReviewStatus",${reason},${context.userId}::uuid)`);
      await tx.auditEvent.create({data:{organizationId:input.organizationId,actorUserId:context.userId,action:`MANAGEMENT_REVIEW_${input.toStatus}`,entityType:"ManagementReview",entityId:input.managementReviewId,reason,metadata:{fromStatus:current.status,toStatus:input.toStatus}}});
      await notificationRouter.publishConfigured(tx,{organizationId:input.organizationId,topicKey:"management_review.lifecycle",eventKey:`management-review:${input.managementReviewId}:status:${input.toStatus}`,payload:{managementReviewId:input.managementReviewId,fromStatus:current.status,toStatus:input.toStatus}});
      return{status:input.toStatus};
    });
  }

  async transitionAction(context:AuthorizationContext,input:{organizationId:string;managementReviewActionId:string;toStatus:"IN_PROGRESS"|"COMPLETED"|"CANCELLED";reason:string}){
    requireAuthorization(context,{organizationId:input.organizationId,permission:"management_review.manage"});
    const reason=input.reason.trim(); if(!reason)throw new ManagementReviewError("Transition reason is required");
    return db.$transaction(async tx=>{
      const current=(await tx.$queryRaw<Array<{status:ActionStatus}>>(Prisma.sql`SELECT status FROM "ManagementReviewAction" WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.managementReviewActionId}::uuid FOR UPDATE`))[0];
      if(!current)throw new ManagementReviewError("Management review action not found");
      const completed=input.toStatus==="COMPLETED"?Prisma.sql`,"completedAt"=CURRENT_TIMESTAMP`:Prisma.empty;
      await tx.$executeRaw(Prisma.sql`UPDATE "ManagementReviewAction" SET status=${input.toStatus}::"ManagementReviewActionStatus" ${completed} WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.managementReviewActionId}::uuid`);
      await tx.$executeRaw(Prisma.sql`INSERT INTO "ManagementReviewActionStatusChange" ("organizationId","managementReviewActionId","fromStatus","toStatus",reason,"actorUserId") VALUES (${input.organizationId}::uuid,${input.managementReviewActionId}::uuid,${current.status}::"ManagementReviewActionStatus",${input.toStatus}::"ManagementReviewActionStatus",${reason},${context.userId}::uuid)`);
      await tx.auditEvent.create({data:{organizationId:input.organizationId,actorUserId:context.userId,action:`MANAGEMENT_REVIEW_ACTION_${input.toStatus}`,entityType:"ManagementReviewAction",entityId:input.managementReviewActionId,reason,metadata:{fromStatus:current.status,toStatus:input.toStatus}}});
      await notificationRouter.publishConfigured(tx,{organizationId:input.organizationId,topicKey:"management_review.action.lifecycle",eventKey:`management-review-action:${input.managementReviewActionId}:status:${input.toStatus}`,payload:{managementReviewActionId:input.managementReviewActionId,fromStatus:current.status,toStatus:input.toStatus}});
      return{status:input.toStatus};
    });
  }
}
