import { Prisma } from "@prisma/client";
import type { AuthorizationContext } from "../security/authorization";
import { requireAuthorization } from "../security/authorization";
import { db } from "../db";
import { InventoryValidationError } from "./inventory";

export type InventoryWorkspaceSummary={materials:number;lots:number;acceptedLots:number;quarantinedLots:number;recalledLots:number;expiredLots:number;lowStockOpen:number;activeReservations:number;unresolvedRecallImpacts:number;totalQuantityOnHand:string;totalReservedQuantity:string};

export class InventoryWorkspaceService {
 async summary(context:AuthorizationContext,organizationId:string){
  requireAuthorization(context,{organizationId,permission:"inventory.read"});
  const rows=await db.$queryRaw<InventoryWorkspaceSummary[]>(Prisma.sql`
    SELECT
      (SELECT count(*)::int FROM "Material" WHERE "organizationId"=${organizationId}::uuid) AS materials,
      (SELECT count(*)::int FROM "MaterialLot" WHERE "organizationId"=${organizationId}::uuid) AS lots,
      (SELECT count(*)::int FROM "MaterialLot" WHERE "organizationId"=${organizationId}::uuid AND status='ACCEPTED') AS "acceptedLots",
      (SELECT count(*)::int FROM "MaterialLot" WHERE "organizationId"=${organizationId}::uuid AND status='QUARANTINED') AS "quarantinedLots",
      (SELECT count(*)::int FROM "MaterialLot" WHERE "organizationId"=${organizationId}::uuid AND status='RECALLED') AS "recalledLots",
      (SELECT count(*)::int FROM "MaterialLot" WHERE "organizationId"=${organizationId}::uuid AND status='EXPIRED') AS "expiredLots",
      (SELECT count(*)::int FROM "InventoryLowStockEvent" WHERE "organizationId"=${organizationId}::uuid AND "resolvedAt" IS NULL) AS "lowStockOpen",
      (SELECT count(*)::int FROM "InventoryReservation" WHERE "organizationId"=${organizationId}::uuid AND status='ACTIVE') AS "activeReservations",
      (SELECT count(*)::int FROM "MaterialRecallImpact" i WHERE i."organizationId"=${organizationId}::uuid AND NOT EXISTS (SELECT 1 FROM "MaterialRecallImpactActionEvent" a WHERE a."organizationId"=i."organizationId" AND a."materialRecallImpactId"=i.id AND a.action='CLOSURE')) AS "unresolvedRecallImpacts",
      COALESCE((SELECT sum("quantityOnHand")::text FROM "InventoryBalance" WHERE "organizationId"=${organizationId}::uuid),'0') AS "totalQuantityOnHand",
      COALESCE((SELECT sum("quantity")::text FROM "InventoryReservation" WHERE "organizationId"=${organizationId}::uuid AND status='ACTIVE'),'0') AS "totalReservedQuantity"
  `);
  return rows[0]??{materials:0,lots:0,acceptedLots:0,quarantinedLots:0,recalledLots:0,expiredLots:0,lowStockOpen:0,activeReservations:0,unresolvedRecallImpacts:0,totalQuantityOnHand:"0",totalReservedQuantity:"0"};
 }
 async issueLabel(context:AuthorizationContext,input:{organizationId:string;lotId:string}){
  requireAuthorization(context,{organizationId:input.organizationId,permission:"inventory.manage"});
  return db.$transaction(async tx=>{
    const lot=(await tx.$queryRaw<Array<{id:string;lotNumber:string;status:string;expirationDate:Date|null;barcodeValue:string|null;materialNumber:string;materialName:string}>>(Prisma.sql`
      SELECT l.id,l."lotNumber",l.status,l."expirationDate",l."barcodeValue",m."materialNumber",m.name AS "materialName"
      FROM "MaterialLot" l JOIN "Material" m ON m."organizationId"=l."organizationId" AND m.id=l."materialId"
      WHERE l."organizationId"=${input.organizationId}::uuid AND l.id=${input.lotId}::uuid FOR UPDATE
    `))[0];
    if(!lot)throw new InventoryValidationError("Material lot not found");
    if(!lot.barcodeValue)throw new InventoryValidationError("Material lot requires an assigned barcode before label issuance");
    const labelPayload={barcodeValue:lot.barcodeValue,materialNumber:lot.materialNumber,materialName:lot.materialName,lotNumber:lot.lotNumber,status:lot.status,expirationDate:lot.expirationDate?.toISOString().slice(0,10)??null};
    const row=(await tx.$queryRaw<Array<{id:string;issuedAt:Date}>>(Prisma.sql`INSERT INTO "InventoryLabelIssue" ("organizationId","materialLotId","barcodeValue","labelPayload","issuedByUserId") VALUES (${input.organizationId}::uuid,${input.lotId}::uuid,${lot.barcodeValue},${JSON.stringify(labelPayload)}::jsonb,${context.userId}::uuid) RETURNING id,"issuedAt"`))[0];
    if(!row)throw new InventoryValidationError("Inventory label could not be issued");
    await tx.auditEvent.create({data:{organizationId:input.organizationId,actorUserId:context.userId,action:"INVENTORY_LABEL_ISSUED",entityType:"MaterialLot",entityId:input.lotId,metadata:{labelIssueId:row.id,barcodeValue:lot.barcodeValue,labelPayload}}});
    return{id:row.id,issuedAt:row.issuedAt,labelPayload};
  });
 }
}