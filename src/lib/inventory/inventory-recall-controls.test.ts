import { describe,expect,it } from "vitest";
import type { AuthorizationContext } from "../security/authorization";
import { InventoryRecallControlService } from "./inventory-recall-controls";
const organizationId="11111111-1111-4111-8111-111111111111",userId="22222222-2222-4222-8222-222222222222";
const context=(permissions:string[]):AuthorizationContext=>({organizationId,userId,userState:"ACTIVE",grants:permissions.map(permission=>({permission,scopeType:"ORGANIZATION" as const,scopeId:null}))});
describe("InventoryRecallControlService authorization and validation",()=>{
 it("requires inventory.manage for impact disposition",async()=>{await expect(new InventoryRecallControlService().dispositionImpact(context(["inventory.read"]),{organizationId,impactId:"33333333-3333-4333-8333-333333333333",disposition:"NO_IMPACT",reason:"Reviewed"})).rejects.toThrow("Access denied");});
 it("requires inventory.manage for impact closure",async()=>{await expect(new InventoryRecallControlService().closeImpact(context(["inventory.read"]),{organizationId,impactId:"33333333-3333-4333-8333-333333333333",reason:"Closed"})).rejects.toThrow("Access denied");});
 it("rejects blank disposition reason before database access",async()=>{await expect(new InventoryRecallControlService().dispositionImpact(context(["inventory.manage"]),{organizationId,impactId:"33333333-3333-4333-8333-333333333333",disposition:"NO_IMPACT",reason:" "})).rejects.toThrow("reason is required");});
});
