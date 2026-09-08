import { describe,expect,it,vi } from "vitest";
import type { AuthorizationContext } from "../security/authorization";
import { EquipmentRecallService,EquipmentRecallValidationError,type EquipmentRecallStore } from "./recall";
const organizationId="00000000-0000-0000-0000-000000000001",userId="00000000-0000-0000-0000-000000000002",equipmentId="00000000-0000-0000-0000-000000000003";
const context=(permissions:string[]):AuthorizationContext=>({organizationId,userId,userState:"ACTIVE",grants:permissions.map(permission=>({permission,scopeType:"ORGANIZATION" as const,scopeId:null}))});
const store=():EquipmentRecallStore=>({list:vi.fn(async()=>[]),open:vi.fn(async input=>({id:"00000000-0000-0000-0000-000000000004",organizationId,equipmentId:input.equipmentId,reason:input.reason,scopeSummary:input.scopeSummary,openedByUserId:input.actorUserId,openedAt:new Date(),status:"OPEN",closedByUserId:null,closedAt:null,closureReason:null})),close:vi.fn(async input=>({id:input.recallId,organizationId,equipmentId:input.equipmentId,reason:"Recall",scopeSummary:"Scope",openedByUserId:userId,openedAt:new Date(),status:"CLOSED",closedByUserId:input.actorUserId,closedAt:new Date(),closureReason:input.reason}))});
describe("EquipmentRecallService",()=>{
 it("requires equipment.read for recall history",()=>{expect(()=>new EquipmentRecallService(store()).list(context([]),organizationId,equipmentId)).toThrow("Access denied");});
 it("requires equipment.manage to open a recall",()=>{expect(()=>new EquipmentRecallService(store()).open(context(["equipment.read"]),{organizationId,equipmentId,reason:"Failure",scopeSummary:"Affected runs"})).toThrow("Access denied");});
 it("rejects blank recall reasons",()=>{expect(()=>new EquipmentRecallService(store()).open(context(["equipment.manage"]),{organizationId,equipmentId,reason:" ",scopeSummary:"Affected runs"})).toThrow(EquipmentRecallValidationError);});
 it("requires a controlled closure reason",()=>{expect(()=>new EquipmentRecallService(store()).close(context(["equipment.manage"]),{organizationId,equipmentId,recallId:"00000000-0000-0000-0000-000000000004",reason:" "})).toThrow(EquipmentRecallValidationError);});
});
