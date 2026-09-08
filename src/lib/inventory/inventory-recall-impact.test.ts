import { describe,expect,it } from "vitest";
import type { AuthorizationContext } from "../security/authorization";
import { InventoryRecallImpactService } from "./inventory-recall-impact";
const organizationId="11111111-1111-4111-8111-111111111111",userId="22222222-2222-4222-8222-222222222222";
const context=(permissions:string[]):AuthorizationContext=>({organizationId,userId,userState:"ACTIVE",grants:permissions.map(permission=>({permission,scopeType:"ORGANIZATION" as const,scopeId:null}))});
describe("InventoryRecallImpactService authorization",()=>{it("requires inventory.read",async()=>{await expect(new InventoryRecallImpactService().list(context([]),organizationId)).rejects.toThrow("Access denied");});});
