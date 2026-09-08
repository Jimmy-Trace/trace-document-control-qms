import { describe,expect,it,vi } from "vitest";
import type { AuthorizationContext } from "../security/authorization";
import { QualityInvestigationService,QualityInvestigationValidationError,type QualityInvestigationRecord,type QualityInvestigationStore } from "./investigations";

const organizationId="00000000-0000-0000-0000-000000000001";const userId="00000000-0000-0000-0000-000000000002";const eventId="00000000-0000-0000-0000-000000000003";
const context=(permissions:string[]):AuthorizationContext=>({organizationId,userId,userState:"ACTIVE",grants:permissions.map(permission=>({permission,scopeType:"ORGANIZATION" as const,scopeId:null}))});
const record:QualityInvestigationRecord={id:"00000000-0000-0000-0000-000000000004",organizationId,eventId,sequence:1,findings:"Findings",affectedScope:"Scope",evidenceSummary:null,rootCauseMethod:"FIVE_WHYS",rootCause:"Cause",riskLikelihood:3,riskImpact:4,riskScore:12,investigatorUserId:userId,createdAt:new Date()};
const store=():QualityInvestigationStore=>({list:vi.fn(async()=>[]),create:vi.fn(async()=>record)});

describe("QualityInvestigationService",()=>{
  it("requires quality_event.read for browsing",()=>{const service=new QualityInvestigationService(store());expect(()=>service.list(context([]),organizationId,eventId)).toThrow("Access denied");});
  it("requires quality_event.manage for recording",()=>{const service=new QualityInvestigationService(store());expect(()=>service.create(context(["quality_event.read"]),{organizationId,eventId,findings:"Findings",affectedScope:"Scope",rootCauseMethod:"FIVE_WHYS",rootCause:"Cause",riskLikelihood:3,riskImpact:4})).toThrow("Access denied");});
  it("requires findings affected scope and root cause",()=>{const service=new QualityInvestigationService(store());expect(()=>service.create(context(["quality_event.manage"]),{organizationId,eventId,findings:" ",affectedScope:"Scope",rootCauseMethod:"FIVE_WHYS",rootCause:"Cause",riskLikelihood:3,riskImpact:4})).toThrow(QualityInvestigationValidationError);});
  it("enforces the 1 to 5 risk matrix",()=>{const service=new QualityInvestigationService(store());expect(()=>service.create(context(["quality_event.manage"]),{organizationId,eventId,findings:"Findings",affectedScope:"Scope",rootCauseMethod:"FIVE_WHYS",rootCause:"Cause",riskLikelihood:6,riskImpact:4})).toThrow("Risk likelihood");});
  it("normalizes evidence before persistence",async()=>{const s=store();const service=new QualityInvestigationService(s);await service.create(context(["quality_event.manage"]),{organizationId,eventId,findings:"  Findings  ",affectedScope:"  Scope  ",evidenceSummary:"  Evidence  ",rootCauseMethod:"FISHBONE",rootCause:"  Cause  ",riskLikelihood:3,riskImpact:4});expect(s.create).toHaveBeenCalledWith(expect.objectContaining({findings:"Findings",affectedScope:"Scope",evidenceSummary:"Evidence",rootCause:"Cause",investigatorUserId:userId}));});
});
