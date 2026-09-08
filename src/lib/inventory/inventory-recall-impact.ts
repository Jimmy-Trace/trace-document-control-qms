import { Prisma } from "@prisma/client";
import type { AuthorizationContext } from "../security/authorization";
import { requireAuthorization } from "../security/authorization";
import { db } from "../db";

export type MaterialRecallImpactRecord={id:string;organizationId:string;materialRecallId:string;materialLotId:string;priorUseCount:number;affectedEquipmentCount:number;earliestUseAt:Date|null;latestUseAt:Date|null;createdAt:Date};

export class InventoryRecallImpactService {
  async list(context:AuthorizationContext,organizationId:string,materialRecallId?:string){
    requireAuthorization(context,{organizationId,permission:"inventory.read"});
    return db.$queryRaw<MaterialRecallImpactRecord[]>(Prisma.sql`
      SELECT * FROM "MaterialRecallImpact"
      WHERE "organizationId"=${organizationId}::uuid
      ${materialRecallId?Prisma.sql`AND "materialRecallId"=${materialRecallId}::uuid`:Prisma.empty}
      ORDER BY "createdAt" DESC
    `);
  }
}
