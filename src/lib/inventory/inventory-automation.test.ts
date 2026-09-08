import { describe,expect,it } from "vitest";
import type { AuthorizationContext } from "../security/authorization";
import { InventoryAutomationService } from "./inventory-automation";
const organizationId="11111111-1111-4111-8111-111111111111",userId="22222222-2222-4222-8222-222222222222";
const context=(permissions:string[]):AuthorizationContext=>({organizationId,userId,userState:"ACTIVE",grants:permissions.map(permission=>({permission,scopeType:"ORGANIZATION" as const,scopeId:null}))});
describe("InventoryAutomationService authorization",()=>{
 it("requires inventory.manage for reservation consumption",async()=>{await expect(new InventoryAutomationService().consumeReservation(context(["inventory.read"]),{organizationId,reservationId:"33333333-3333-4333-8333-333333333333",reason:"Use",occurredAt:new Date()})).rejects.toThrow("Access denied");});
 it("requires inventory.manage for automated evaluation",async()=>{await expect(new InventoryAutomationService().evaluate(context(["inventory.read"]),organizationId)).rejects.toThrow("Access denied");});
 it("rejects blank consumption reason before database access",async()=>{await expect(new InventoryAutomationService().consumeReservation(context(["inventory.manage"]),{organizationId,reservationId:"33333333-3333-4333-8333-333333333333",reason:" ",occurredAt:new Date()})).rejects.toThrow("Consumption reason is required");});
});