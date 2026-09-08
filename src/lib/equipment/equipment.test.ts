import { describe,expect,it,vi } from "vitest";
import type { AuthorizationContext } from "../security/authorization";
import { EquipmentService,EquipmentValidationError,type EquipmentRecord,type EquipmentStore } from "./equipment";
const organizationId="00000000-0000-0000-0000-000000000001",userId="00000000-0000-0000-0000-000000000002";
const context=(permissions:string[]):AuthorizationContext=>({organizationId,userId,userState:"ACTIVE",grants:permissions.map(permission=>({permission,scopeType:"ORGANIZATION" as const,scopeId:null}))});
const record:EquipmentRecord={id:"00000000-0000-0000-0000-000000000003",organizationId,equipmentNumber:"EQ-001",name:"Analyzer",manufacturer:null,model:null,serialNumber:null,siteId:null,departmentId:null,status:"PLANNED",receivedAt:null,placedInServiceAt:null,calibrationRequired:false,calibrationIntervalDays:null,nextCalibrationDueAt:null,maintenanceRequired:false,maintenanceIntervalDays:null,nextMaintenanceDueAt:null,createdByUserId:userId,createdAt:new Date(),updatedAt:new Date()};
const store=():EquipmentStore=>({list:vi.fn(async()=>[]),create:vi.fn(async()=>record),listEvents:vi.fn(async()=>[]),addEvent:vi.fn(async input=>({id:"00000000-0000-0000-0000-000000000004",organizationId:input.organizationId,equipmentId:input.equipmentId,eventType:input.eventType,occurredAt:input.occurredAt,summary:input.summary,evidenceFileId:input.evidenceFileId,performedByUserId:input.performedByUserId,createdByUserId:input.actorUserId,createdAt:new Date()}))});
describe("EquipmentService",()=>{
 it("requires equipment.read for browsing",()=>{expect(()=>new EquipmentService(store()).list(context([]),organizationId)).toThrow("Access denied");});
 it("requires equipment.manage for creation",()=>{expect(()=>new EquipmentService(store()).create(context(["equipment.read"]),{organizationId,equipmentNumber:"EQ-1",name:"Analyzer"})).toThrow("Access denied");});
 it("rejects blank equipment identity",()=>{expect(()=>new EquipmentService(store()).create(context(["equipment.manage"]),{organizationId,equipmentNumber:" ",name:"Analyzer"})).toThrow(EquipmentValidationError);});
 it("requires a calibration interval when calibration is controlled",()=>{expect(()=>new EquipmentService(store()).create(context(["equipment.manage"]),{organizationId,equipmentNumber:"EQ-1",name:"Analyzer",calibrationRequired:true})).toThrow("Calibration interval");});
 it("normalizes equipment event evidence",async()=>{const s=store();await new EquipmentService(s).addEvent(context(["equipment.manage"]),{organizationId,equipmentId:record.id,eventType:"RECEIVED",occurredAt:new Date("2026-09-08T12:00:00Z"),summary:"  Received intact  "});expect(s.addEvent).toHaveBeenCalledWith(expect.objectContaining({summary:"Received intact",actorUserId:userId}));});
});
