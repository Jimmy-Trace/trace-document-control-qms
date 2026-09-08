import { describe,expect,it } from "vitest";
import type { AuthorizationContext } from "../security/authorization";
import { LaboratoryTestMethodService } from "./test-methods";

const organizationId="11111111-1111-4111-8111-111111111111";
const userId="22222222-2222-4222-8222-222222222222";
const context=(permissions:string[]):AuthorizationContext=>({organizationId,userId,userState:"ACTIVE",grants:permissions.map(permission=>({permission,scopeType:"ORGANIZATION" as const,scopeId:null}))});

describe("LaboratoryTestMethodService authorization and validation",()=>{
  it("requires lab_test.read for listing",async()=>{await expect(new LaboratoryTestMethodService().list(context([]),organizationId)).rejects.toThrow("Access denied");});
  it("requires lab_test.manage for test creation",async()=>{await expect(new LaboratoryTestMethodService().createTest(context(["lab_test.read"]),{organizationId,testCode:"T-1",name:"Test"})).rejects.toThrow("Access denied");});
  it("rejects blank test identity before database access",async()=>{await expect(new LaboratoryTestMethodService().createTest(context(["lab_test.manage"]),{organizationId,testCode:" ",name:"Test"})).rejects.toThrow("Test code and name are required");});
  it("requires a retirement reason before database access",async()=>{await expect(new LaboratoryTestMethodService().retire(context(["lab_test.manage"]),{organizationId,entityType:"test",entityId:"33333333-3333-4333-8333-333333333333",reason:" "})).rejects.toThrow("Retirement reason is required");});
});
