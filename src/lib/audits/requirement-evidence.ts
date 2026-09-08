import { Prisma } from "@prisma/client";
import { db } from "../db";
import type { AuthorizationContext } from "../security/authorization";
import { requireAuthorization } from "../security/authorization";

export class RequirementEvidenceError extends Error {}

type EvidenceType="POLICY"|"PROCEDURE"|"RECORD"|"REPORT"|"AUDIT_EVIDENCE"|"MANAGEMENT_REVIEW"|"OTHER";
type AssessmentOutcome="NOT_ASSESSED"|"COMPLIANT"|"PARTIALLY_COMPLIANT"|"NONCOMPLIANT";

export class RequirementEvidenceService {
  async addEvidence(context:AuthorizationContext,input:{organizationId:string;accreditationRequirementId:string;evidenceFileId:string;evidenceType:EvidenceType;description:string;effectiveAt?:string|null;expiresAt?:string|null}){
    requireAuthorization(context,{organizationId:input.organizationId,permission:"requirement_evidence.manage"});
    const description=input.description.trim();
    if(!description)throw new RequirementEvidenceError("Evidence description is required");
    return db.$transaction(async tx=>{
      const requirement=(await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`SELECT id FROM "AccreditationRequirement" WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.accreditationRequirementId}::uuid`))[0];
      if(!requirement)throw new RequirementEvidenceError("Accreditation requirement not found");
      const file=(await tx.$queryRaw<Array<{status:string}>>(Prisma.sql`SELECT status FROM "FileObject" WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.evidenceFileId}::uuid`))[0];
      if(!file||file.status!=="AVAILABLE")throw new RequirementEvidenceError("Evidence file must be AVAILABLE");
      const row=(await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`INSERT INTO "RequirementEvidence" ("organizationId","accreditationRequirementId","evidenceFileId","evidenceType",description,"effectiveAt","expiresAt","recordedByUserId") VALUES (${input.organizationId}::uuid,${input.accreditationRequirementId}::uuid,${input.evidenceFileId}::uuid,${input.evidenceType}::"RequirementEvidenceType",${description},${input.effectiveAt??null}::timestamptz,${input.expiresAt??null}::timestamptz,${context.userId}::uuid) RETURNING id`))[0];
      if(!row)throw new RequirementEvidenceError("Requirement evidence could not be recorded");
      await tx.auditEvent.create({data:{organizationId:input.organizationId,actorUserId:context.userId,action:"REQUIREMENT_EVIDENCE_RECORDED",entityType:"RequirementEvidence",entityId:row.id,metadata:{accreditationRequirementId:input.accreditationRequirementId,evidenceFileId:input.evidenceFileId,evidenceType:input.evidenceType}}});
      return row;
    });
  }

  async assessRequirement(context:AuthorizationContext,input:{organizationId:string;accreditationRequirementId:string;outcome:AssessmentOutcome;rationale:string}){
    requireAuthorization(context,{organizationId:input.organizationId,permission:"requirement_evidence.manage"});
    const rationale=input.rationale.trim();
    if(!rationale)throw new RequirementEvidenceError("Assessment rationale is required");
    return db.$transaction(async tx=>{
      const requirement=(await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`SELECT id FROM "AccreditationRequirement" WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.accreditationRequirementId}::uuid`))[0];
      if(!requirement)throw new RequirementEvidenceError("Accreditation requirement not found");
      if(input.outcome==="COMPLIANT"){
        const evidence=(await tx.$queryRaw<Array<{count:number}>>(Prisma.sql`SELECT count(*)::integer AS count FROM "RequirementEvidence" WHERE "organizationId"=${input.organizationId}::uuid AND "accreditationRequirementId"=${input.accreditationRequirementId}::uuid`))[0]?.count??0;
        if(evidence===0)throw new RequirementEvidenceError("COMPLIANT assessment requires mapped requirement evidence");
      }
      const row=(await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`INSERT INTO "RequirementAssessment" ("organizationId","accreditationRequirementId",outcome,rationale,"assessedByUserId") VALUES (${input.organizationId}::uuid,${input.accreditationRequirementId}::uuid,${input.outcome}::"RequirementAssessmentOutcome",${rationale},${context.userId}::uuid) RETURNING id`))[0];
      if(!row)throw new RequirementEvidenceError("Requirement assessment could not be recorded");
      await tx.auditEvent.create({data:{organizationId:input.organizationId,actorUserId:context.userId,action:"REQUIREMENT_ASSESSED",entityType:"RequirementAssessment",entityId:row.id,reason:rationale,metadata:{accreditationRequirementId:input.accreditationRequirementId,outcome:input.outcome}}});
      return row;
    });
  }

  async listCoverage(context:AuthorizationContext,input:{organizationId:string;accreditationProgramId:string}){
    requireAuthorization(context,{organizationId:input.organizationId,permission:"requirement_evidence.read"});
    return db.$queryRaw(Prisma.sql`
      SELECT r.id,r."requirementCode",r.title,
        COALESCE(e."evidenceCount",0)::integer AS "evidenceCount",
        a.outcome AS "latestOutcome",a."assessedAt"
      FROM "AccreditationRequirement" r
      LEFT JOIN LATERAL (
        SELECT count(*) AS "evidenceCount" FROM "RequirementEvidence" e
        WHERE e."organizationId"=r."organizationId" AND e."accreditationRequirementId"=r.id
      ) e ON true
      LEFT JOIN LATERAL (
        SELECT outcome,"assessedAt" FROM "RequirementAssessment" a
        WHERE a."organizationId"=r."organizationId" AND a."accreditationRequirementId"=r.id
        ORDER BY "assessedAt" DESC,id DESC LIMIT 1
      ) a ON true
      WHERE r."organizationId"=${input.organizationId}::uuid AND r."accreditationProgramId"=${input.accreditationProgramId}::uuid
      ORDER BY r."requirementCode"`);
  }
}
