import { describe,expect,it } from "vitest";
import type { AuthorizationContext } from "../security/authorization";
import { InventoryControlsService } from "./inventory-controls";
const organizationId="11111111-1111-4111-8111-111111111111",userId="22222222-2222-4222-8222-222222222222";
const context=(permissions:string[]):AuthorizationContext=>({organizationId,userId,userState:"ACTIVE",grants:permissions.map(permission=>({permission,scopeType:"ORGANIZATION" as const,scopeId:null}))});
describe("InventoryControlsService authorization",()=>{
 it("requires inventory.read for barcode resolution",()=>{expect(()=>new InventoryControlsService().resolveBarcode(context([]),organizationId,"LOT-BC-1")).toThrow("Access denied");});
 it("requires inventory.manage for barcode assignment",()=>{expect(()=>new InventoryControlsService().assignBarcode(context(["inventory.read"]),{organizationId,lotId:"33333333-3333-4333-8333-333333333333",barcodeValue:"LOT-BC-1"})).toThrow("Access denied");});
 it("requires inventory.manage for reservations",()=>{expect(()=>new InventoryControlsService().reserve(context(["inventory.read"]),{organizationId,lotId:"33333333-3333-4333-8333-333333333333",quantity:1,unitOfMeasure:"mL",referenceKey:"RES-1",reason:"Run allocation"})).toThrow("Access denied");});
 it("rejects negative low-stock thresholds before database access",()=>{expect(()=>new InventoryControlsService().upsertLowStockThreshold(context(["inventory.manage"]),{organizationId,materialId:"44444444-4444-4444-8444-444444444444",thresholdQuantity:-1,unitOfMeasure:"mL"})).toThrow("cannot be negative");});
});
