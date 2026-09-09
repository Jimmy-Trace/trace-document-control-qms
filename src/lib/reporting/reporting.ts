import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "../db";
import type { AuthorizationContext } from "../security/authorization";
import { requireAuthorization } from "../security/authorization";

export type ReportSourceKey="QUALITY_EVENT_SUMMARY"|"EQUIPMENT_SUMMARY";
export const reportSourceKeys:readonly ReportSourceKey[]=["QUALITY_EVENT_SUMMARY","EQUIPMENT_SUMMARY"] as const;
export class ReportingError extends Error {}

type ReportDefinitionRow={id:string;code:string;name:string;description:string|null;sourceKey:ReportSourceKey;active:boolean;createdAt:Date};
type ReportExecutionRow={id:string;reportDefinitionId:string;reportCode:string;reportName:string;sourceKey:ReportSourceKey;parameters:unknown;result:unknown;resultSha256:string;rowCount:number;executedAt:Date};

export function validateReportingParameters(parameters:unknown):Record<string,never>{
  if(parameters===undefined||parameters===null)return{};
  if(typeof parameters!=="object"||Array.isArray(parameters))throw new ReportingError("Report parameters must be an object");
  if(Object.keys(parameters as Record<string,unknown>).length>0)throw new ReportingError("This report source does not accept parameters in the foundation slice");
  return{};
}

async function executeSource(tx:Prisma.TransactionClient,organizationId:string,sourceKey:ReportSourceKey){
  if(sourceKey==="QUALITY_EVENT_SUMMARY"){
    const rows=await tx.$queryRaw<Array<{status:string;count:number}>>(Prisma.sql`
      SELECT status::text AS status,count(*)::int AS count FROM "QualityEvent"
      WHERE "organizationId"=${organizationId}::uuid GROUP BY status ORDER BY status`);
    return rows;
  }
  if(sourceKey==="EQUIPMENT_SUMMARY"){
    const rows=await tx.$queryRaw<Array<{status:string;count:number}>>(Prisma.sql`
      SELECT status::text AS status,count(*)::int AS count FROM "Equipment"
      WHERE "organizationId"=${organizationId}::uuid GROUP BY status ORDER BY status`);
    return rows;
  }
  throw new ReportingError("Unsupported governed report source");
}

export class ReportingService{
  async listDefinitions(context:AuthorizationContext,organizationId:string){
    requireAuthorization(context,{organizationId,permission:"report.read"});
    return db.$queryRaw<ReportDefinitionRow[]>(Prisma.sql`SELECT id,code,name,description,"sourceKey",active,"createdAt" FROM "ReportDefinition" WHERE "organizationId"=${organizationId}::uuid ORDER BY code`);
  }

  async createDefinition(context:AuthorizationContext,input:{organizationId:string;code:string;name:string;description?:string|null;sourceKey:ReportSourceKey}){
    requireAuthorization(context,{organizationId:input.organizationId,permission:"report.manage"});
    const code=input.code.trim().toUpperCase(),name=input.name.trim(),description=input.description?.trim()||null;
    if(!code||!name)throw new ReportingError("Report code and name are required");
    if(!reportSourceKeys.includes(input.sourceKey))throw new ReportingError("Unsupported governed report source");
    return db.$transaction(async tx=>{
      const row=(await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`INSERT INTO "ReportDefinition" ("organizationId",code,name,description,"sourceKey","createdByUserId") VALUES (${input.organizationId}::uuid,${code},${name},${description},${input.sourceKey}::"ReportSourceKey",${context.userId}::uuid) RETURNING id`))[0];
      if(!row)throw new ReportingError("Report definition could not be created");
      await tx.auditEvent.create({data:{organizationId:input.organizationId,actorUserId:context.userId,action:"REPORT_DEFINITION_CREATED",entityType:"ReportDefinition",entityId:row.id,metadata:{code,sourceKey:input.sourceKey}}});
      return row;
    });
  }

  async execute(context:AuthorizationContext,input:{organizationId:string;reportDefinitionId:string;parameters?:unknown}){
    requireAuthorization(context,{organizationId:input.organizationId,permission:"report.read"});
    const parameters=validateReportingParameters(input.parameters);
    return db.$transaction(async tx=>{
      const definition=(await tx.$queryRaw<ReportDefinitionRow[]>(Prisma.sql`SELECT id,code,name,description,"sourceKey",active,"createdAt" FROM "ReportDefinition" WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.reportDefinitionId}::uuid FOR SHARE`))[0];
      if(!definition||!definition.active)throw new ReportingError("Active report definition not found");
      const result=await executeSource(tx,input.organizationId,definition.sourceKey);
      const canonical=JSON.stringify(result);
      const resultSha256=createHash("sha256").update(canonical).digest("hex");
      const execution=(await tx.$queryRaw<Array<{id:string;executedAt:Date}>>(Prisma.sql`INSERT INTO "ReportExecution" ("organizationId","reportDefinitionId","reportCode","reportName","sourceKey",parameters,result,"resultSha256","rowCount","executedByUserId") VALUES (${input.organizationId}::uuid,${definition.id}::uuid,${definition.code},${definition.name},${definition.sourceKey}::"ReportSourceKey",${JSON.stringify(parameters)}::jsonb,${canonical}::jsonb,${resultSha256},${result.length},${context.userId}::uuid) RETURNING id,"executedAt"`))[0];
      if(!execution)throw new ReportingError("Report execution could not be recorded");
      await tx.auditEvent.create({data:{organizationId:input.organizationId,actorUserId:context.userId,action:"REPORT_EXECUTED",entityType:"ReportExecution",entityId:execution.id,metadata:{reportDefinitionId:definition.id,reportCode:definition.code,sourceKey:definition.sourceKey,rowCount:result.length,resultSha256}}});
      return{executionId:execution.id,executedAt:execution.executedAt,report:{code:definition.code,name:definition.name,sourceKey:definition.sourceKey},parameters,result,rowCount:result.length,resultSha256};
    });
  }

  async listExecutions(context:AuthorizationContext,organizationId:string,reportDefinitionId:string){
    requireAuthorization(context,{organizationId,permission:"report.read"});
    return db.$queryRaw<ReportExecutionRow[]>(Prisma.sql`SELECT id,"reportDefinitionId","reportCode","reportName","sourceKey",parameters,result,"resultSha256","rowCount","executedAt" FROM "ReportExecution" WHERE "organizationId"=${organizationId}::uuid AND "reportDefinitionId"=${reportDefinitionId}::uuid ORDER BY "executedAt" DESC LIMIT 100`);
  }
}
