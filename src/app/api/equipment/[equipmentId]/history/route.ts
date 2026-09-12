import { NextRequest,NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { authenticateRequest,AuthenticationRequiredError } from "@/lib/security/authenticated-request";
import { requireAuthorization } from "@/lib/security/authorization";

type HistoryEntry={
  id:string;
  kind:"EVENT"|"LIFECYCLE"|"SERVICE"|"AUDIT";
  occurredAt:Date;
  label:string;
  summary:string;
  evidenceFileId:string|null;
};

export async function GET(request:NextRequest,{params}:{params:Promise<{equipmentId:string}>}){
  try{
    const context=await authenticateRequest(request);
    const {equipmentId}=await params;
    requireAuthorization(context,{organizationId:context.organizationId,permission:"equipment.read"});
    const equipment=await db.$queryRaw<Array<{id:string}>>(Prisma.sql`
      SELECT id FROM "Equipment"
      WHERE "organizationId"=${context.organizationId}::uuid AND id=${equipmentId}::uuid
      LIMIT 1
    `);
    if(!equipment[0])return NextResponse.json({error:"Equipment not found"},{status:404});
    const data=await db.$queryRaw<HistoryEntry[]>(Prisma.sql`
      SELECT e.id,'EVENT'::text AS kind,e."occurredAt",e."eventType"::text AS label,e.summary,e."evidenceFileId"
      FROM "EquipmentEvent" e
      WHERE e."organizationId"=${context.organizationId}::uuid AND e."equipmentId"=${equipmentId}::uuid
      UNION ALL
      SELECT s.id,'LIFECYCLE'::text AS kind,s."changedAt",('STATUS '||s."fromStatus"::text||' → '||s."toStatus"::text) AS label,s.reason,NULL::uuid AS "evidenceFileId"
      FROM "EquipmentStatusChange" s
      WHERE s."organizationId"=${context.organizationId}::uuid AND s."equipmentId"=${equipmentId}::uuid
      UNION ALL
      SELECT r.id,'SERVICE'::text AS kind,r."servicedAt",('SERVICE '||r.outcome::text) AS label,
        CASE WHEN r.provider IS NULL OR btrim(r.provider)='' THEN r.description ELSE r.description||' · Provider: '||r.provider END AS summary,
        r."evidenceFileId"
      FROM "EquipmentServiceRecord" r
      WHERE r."organizationId"=${context.organizationId}::uuid AND r."equipmentId"=${equipmentId}::uuid
      UNION ALL
      SELECT a.id,'AUDIT'::text AS kind,a."occurredAt",'SCHEDULE CORRECTED'::text AS label,
        a.reason||' · Calibration due: '||COALESCE(NULLIF(left(a.metadata->>'previousCalibrationDueAt',10),''),'—')||' → '||COALESCE(NULLIF(left(a.metadata->>'nextCalibrationDueAt',10),''),'—')||' · Maintenance due: '||COALESCE(NULLIF(left(a.metadata->>'previousMaintenanceDueAt',10),''),'—')||' → '||COALESCE(NULLIF(left(a.metadata->>'nextMaintenanceDueAt',10),''),'—') AS summary,
        NULL::uuid AS "evidenceFileId"
      FROM "AuditEvent" a
      WHERE a."organizationId"=${context.organizationId}::uuid AND a."entityType"='Equipment' AND a."entityId"=${equipmentId}::uuid AND a.action='EQUIPMENT_SCHEDULE_CORRECTED'
      ORDER BY "occurredAt" DESC
    `);
    return NextResponse.json({data});
  }catch(error){
    if(error instanceof AuthenticationRequiredError)return NextResponse.json({error:"Authentication required"},{status:401});
    if(error instanceof Error&&error.message==="Access denied")return NextResponse.json({error:"Access denied"},{status:403});
    return NextResponse.json({error:"Equipment history operation failed"},{status:500});
  }
}
