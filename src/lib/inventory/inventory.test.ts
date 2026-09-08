import { describe,expect,it,vi } from "vitest";
import type { AuthorizationContext } from "../security/authorization";
import { InventoryService,type InventoryStore } from "./inventory";
const organizationId="11111111-1111-4111-8111-111111111111";
const userId="22222222-2222-4222-8222-222222222222";
const context=(permissions:string[]):AuthorizationContext=>({organizationId,userId,userState:"ACTIVE",grants:permissions.map(permission=>({permission,scopeType:"ORGANIZATION" as const,scopeId:null}))});
const store=():InventoryStore=>({listMaterials:vi.fn().mockResolvedValue([]),createMaterial:vi.fn(),listLots:vi.fn().mockResolvedValue([]),receiveLot:vi.fn(),transitionLot:vi.fn(),listBalances:vi.fn().mockResolvedValue([]),transact:vi.fn()});
describe("InventoryService",()=>{
 it("requires inventory.read",()=>{const service=new InventoryService(store());expect(()=>service.listMaterials(context([]),organizationId)).toThrow("Access denied");});
 it("allows inventory.read browsing",async()=>{const service=new InventoryService(store());await expect(service.listLots(context(["inventory.read"]),organizationId)).resolves.toEqual([]);});
 it("requires inventory.manage for creation",()=>{const service=new InventoryService(store());expect(()=>service.createMaterial(context(["inventory.read"]),{organizationId,materialNumber:"MAT-1",name:"Control"})).toThrow("Access denied");});
});