import { describe, expect, it, vi } from "vitest";
import type { AuthorizationContext } from "../security/authorization";
import { QualityEventAnalyticsService, type QualityEventAnalyticsStore } from "./analytics";

const organizationId="11111111-1111-4111-8111-111111111111";
const userId="22222222-2222-4222-8222-222222222222";
const context=(permissions:string[]):AuthorizationContext=>({organizationId,userId,userState:"ACTIVE",grants:permissions.map(permission=>({permission,scopeType:"ORGANIZATION" as const,scopeId:null}))});
const store=():QualityEventAnalyticsStore=>({report:vi.fn().mockResolvedValue({generatedAt:new Date(),windowStart:new Date(),total:0,open:0,overdue:0,closed:0,byStatus:[],byType:[],bySeverity:[],bySource:[],monthly:[]})});

describe("QualityEventAnalyticsService",()=>{
  it("requires quality_event.read",()=>{
    const service=new QualityEventAnalyticsService(store());
    expect(()=>service.report(context([]),organizationId,12)).toThrow("Access denied");
  });
  it("rejects windows outside 1 to 24 months",()=>{
    const service=new QualityEventAnalyticsService(store());
    expect(()=>service.report(context(["quality_event.read"]),organizationId,0)).toThrow("Invalid analytics window");
    expect(()=>service.report(context(["quality_event.read"]),organizationId,25)).toThrow("Invalid analytics window");
  });
  it("allows governed read-only reporting",async()=>{
    const reportStore=store();
    const service=new QualityEventAnalyticsService(reportStore);
    await service.report(context(["quality_event.read"]),organizationId,12);
    expect(reportStore.report).toHaveBeenCalledOnce();
  });
});
