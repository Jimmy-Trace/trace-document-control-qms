import { describe,expect,it } from "vitest";
import type { AuthorizationContext } from "../security/authorization";
import { ReportingError,ReportingService,reportSourceKeys,reportSourceStatusValues,validateReportingParameters } from "./reporting";

const organizationId="00000000-0000-0000-0000-000000000001";
const userId="00000000-0000-0000-0000-000000000002";
const context=(permissions:string[]):AuthorizationContext=>({organizationId,userId,userState:"ACTIVE",grants:permissions.map(permission=>({permission,scopeType:"ORGANIZATION" as const,scopeId:null}))});

describe("governed reporting boundary",()=>{
  it("exposes only explicitly approved report sources",()=>{
    expect(reportSourceKeys).toEqual(["QUALITY_EVENT_SUMMARY","EQUIPMENT_SUMMARY"]);
    expect(reportSourceKeys).not.toContain("SQL" as never);
  });

  it("accepts only source-approved status filters",()=>{
    expect(validateReportingParameters("QUALITY_EVENT_SUMMARY",{status:"OPEN"})).toEqual({status:"OPEN"});
    expect(validateReportingParameters("EQUIPMENT_SUMMARY",{status:"OUT_OF_SERVICE"})).toEqual({status:"OUT_OF_SERVICE"});
    expect(reportSourceStatusValues.QUALITY_EVENT_SUMMARY).not.toContain("RETIRED");
    expect(()=>validateReportingParameters("QUALITY_EVENT_SUMMARY",{status:"RETIRED"})).toThrow(ReportingError);
    expect(()=>validateReportingParameters("EQUIPMENT_SUMMARY",{sql:"select * from User"})).toThrow(ReportingError);
    expect(()=>validateReportingParameters("EQUIPMENT_SUMMARY",{field:"serialNumber"})).toThrow(ReportingError);
  });

  it("requires report.read before database access",async()=>{
    await expect(new ReportingService().listDefinitions(context([]),organizationId)).rejects.toThrow("Access denied");
    await expect(new ReportingService().listSavedViews(context([]),organizationId,"00000000-0000-0000-0000-000000000003")).rejects.toThrow("Access denied");
  });

  it("requires report.manage before definition creation",async()=>{
    await expect(new ReportingService().createDefinition(context([]),{organizationId,code:"QMS-001",name:"Quality summary",sourceKey:"QUALITY_EVENT_SUMMARY"})).rejects.toThrow("Access denied");
  });
});
