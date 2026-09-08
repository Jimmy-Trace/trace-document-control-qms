import { describe,expect,it } from "vitest";
import type { AuthorizationContext } from "../security/authorization";
import { ProcurementService } from "./procurement";
const organizationId="11111111-1111-4111-8111-111111111111",userId="22222222-2222-4222-8222-222222222222";
const context=(permissions:string[]):AuthorizationContext=>({organizationId,userId,userState:"ACTIVE",grants:permissions.map(permission=>({permission,scopeType:"ORGANIZATION" as const,scopeId:null}))});
describe("ProcurementService authorization and validation",()=>{
 it("requires procurement.read for supplier listing",async()=>{await expect(new ProcurementService().listSuppliers(context([]),organizationId)).rejects.toThrow("Access denied");});
 it("requires procurement.manage for supplier creation",async()=>{await expect(new ProcurementService().createSupplier(context(["procurement.read"]),{organizationId,supplierNumber:"SUP-1",name:"Supplier"})).rejects.toThrow("Access denied");});
 it("rejects empty purchase orders before database access",async()=>{await expect(new ProcurementService().createPurchaseOrder(context(["procurement.manage"]),{organizationId,purchaseOrderNumber:"PO-1",supplierId:"33333333-3333-4333-8333-333333333333",lines:[]})).rejects.toThrow("at least one line");});
});