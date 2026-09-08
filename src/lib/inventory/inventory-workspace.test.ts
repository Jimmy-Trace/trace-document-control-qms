import { describe,expect,it } from "vitest";
import type { AuthorizationContext } from "../security/authorization";
import { InventoryWorkspaceService } from "./inventory-workspace";
const organizationId="11111111-1111-4111-8111-111111111111",userId="22222222-2222-4222-8222-222222222222";
const context=(permissions:string[]):AuthorizationContext=>({organizationId,userId,userState:"ACTIVE",grants:permissions.map(permission=>({permission,scopeType:"ORGANIZATION" as const,scopeId:null}))});
describe("InventoryWorkspaceService authorization",()=>{it("requires inventory.read for summary",async()=>{await expect(new InventoryWorkspaceService().summary(context([]),organizationId)).rejects.toThrow("Access denied");});it("requires inventory.manage for label issuance",async()=>{await expect(new InventoryWorkspaceService().issueLabel(context(["inventory.read"]),{organizationId,lotId:"33333333-3333-4333-8333-333333333333"})).rejects.toThrow("Access denied");});});