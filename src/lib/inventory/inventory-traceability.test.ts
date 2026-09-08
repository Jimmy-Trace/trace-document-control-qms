import { describe,expect,it } from "vitest";
import type { AuthorizationContext } from "../security/authorization";
import { InventoryTraceabilityService } from "./inventory-traceability";
const organizationId="11111111-1111-4111-8111-111111111111",userId="22222222-2222-4222-8222-222222222222";
const context=(permissions:string[]):AuthorizationContext=>({organizationId,userId,userState:"ACTIVE",grants:permissions.map(permission=>({permission,scopeType:"ORGANIZATION" as const,scopeId:null}))});
describe("InventoryTraceabilityService authorization and validation",()=>{
 it("requires inventory.manage for acceptance certificates",async()=>{await expect(new InventoryTraceabilityService().createAcceptanceCertificate(context(["inventory.read"]),{organizationId,lotId:"33333333-3333-4333-8333-333333333333",evidenceFileId:"44444444-4444-4444-8444-444444444444",summary:"Receiving acceptance"})).rejects.toThrow("Access denied");});
 it("requires inventory.manage for equipment use",async()=>{await expect(new InventoryTraceabilityService().recordEquipmentUse(context(["inventory.read"]),{organizationId,lotId:"33333333-3333-4333-8333-333333333333",equipmentId:"55555555-5555-4555-8555-555555555555",referenceType:"RUN",referenceId:"RUN-1",usedAt:new Date()})).rejects.toThrow("Access denied");});
 it("rejects recalls without affected lots before database access",async()=>{await expect(new InventoryTraceabilityService().createRecall(context(["inventory.manage"]),{organizationId,manufacturer:"Vendor",externalReference:"R-1",reason:"Recall notice",lotIds:[]})).rejects.toThrow("at least one lot");});
});
