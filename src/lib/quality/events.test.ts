import { describe, expect, it, vi } from "vitest";
import type { AuthorizationContext } from "../security/authorization";
import { QualityEventService, QualityEventValidationError, type QualityEventRecord, type QualityEventStore } from "./events";

const organizationId="00000000-0000-0000-0000-000000000001";
const userId="00000000-0000-0000-0000-000000000002";
const context=(permissions:string[]):AuthorizationContext=>({organizationId,userId,userState:"ACTIVE",grants:permissions.map(permission=>({permission,scopeType:"ORGANIZATION" as const,scopeId:null}))});
const store=():QualityEventStore=>({
  listEvents:vi.fn(async()=>[]),
  createEvent:vi.fn(async (input: Parameters<QualityEventStore["createEvent"]>[0]): Promise<QualityEventRecord>=>({id:"event-1",organizationId:input.organizationId,eventNumber:"QE-2026-000001",type:input.type,severity:input.severity,source:input.source,status:"OPEN",summary:input.summary,description:input.description,discoveredAt:input.discoveredAt,reportedByUserId:input.actorUserId,ownerUserId:input.ownerUserId,dueAt:input.dueAt,createdAt:new Date(),updatedAt:new Date()})),
});

describe("QualityEventService",()=>{
  it("requires quality_event.read for browsing",()=>{const service=new QualityEventService(store());expect(()=>service.listEvents(context([]),organizationId)).toThrow("Access denied");});
  it("requires quality_event.manage for creation",()=>{const service=new QualityEventService(store());expect(()=>service.createEvent(context(["quality_event.read"]),{organizationId,type:"NONCONFORMANCE",severity:"MEDIUM",summary:"Example",discoveredAt:new Date()})).toThrow("Access denied");});
  it("rejects blank summaries",()=>{const service=new QualityEventService(store());expect(()=>service.createEvent(context(["quality_event.manage"]),{organizationId,type:"NONCONFORMANCE",severity:"MEDIUM",summary:"   ",discoveredAt:new Date()})).toThrow(QualityEventValidationError);});
  it("creates a normalized manual event",async()=>{const s=store();const service=new QualityEventService(s);await service.createEvent(context(["quality_event.manage"]),{organizationId,type:"QC_FAILURE",severity:"HIGH",summary:"  Failed control  ",description:"  Investigation required  ",discoveredAt:new Date("2026-09-08T01:00:00Z")});expect(s.createEvent).toHaveBeenCalledWith(expect.objectContaining({summary:"Failed control",description:"Investigation required",source:"MANUAL",actorUserId:userId}));});
});
