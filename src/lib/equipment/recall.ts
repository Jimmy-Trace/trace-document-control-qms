import type { AuthorizationContext } from "../security/authorization";
import { requireAuthorization } from "../security/authorization";

export class EquipmentRecallValidationError extends Error {}
export type EquipmentRecallRecord={id:string;organizationId:string;equipmentId:string;reason:string;scopeSummary:string;openedByUserId:string|null;openedAt:Date;status:"OPEN"|"CLOSED";closedByUserId:string|null;closedAt:Date|null;closureReason:string|null};
export interface EquipmentRecallStore{
  list(organizationId:string,equipmentId:string):Promise<EquipmentRecallRecord[]>;
  open(input:{organizationId:string;equipmentId:string;reason:string;scopeSummary:string;actorUserId:string}):Promise<EquipmentRecallRecord>;
  close(input:{organizationId:string;equipmentId:string;recallId:string;reason:string;actorUserId:string}):Promise<EquipmentRecallRecord>;
}
export class EquipmentRecallService{
  constructor(private readonly store:EquipmentRecallStore){}
  list(context:AuthorizationContext,organizationId:string,equipmentId:string){requireAuthorization(context,{organizationId,permission:"equipment.read"});return this.store.list(organizationId,equipmentId);}
  open(context:AuthorizationContext,input:{organizationId:string;equipmentId:string;reason:string;scopeSummary:string}){
    requireAuthorization(context,{organizationId:input.organizationId,permission:"equipment.manage"});
    const reason=input.reason.trim(),scopeSummary=input.scopeSummary.trim();
    if(!reason||reason.length>2000)throw new EquipmentRecallValidationError("Recall reason is required and must not exceed 2000 characters");
    if(!scopeSummary||scopeSummary.length>5000)throw new EquipmentRecallValidationError("Recall scope is required and must not exceed 5000 characters");
    return this.store.open({...input,reason,scopeSummary,actorUserId:context.userId});
  }
  close(context:AuthorizationContext,input:{organizationId:string;equipmentId:string;recallId:string;reason:string}){
    requireAuthorization(context,{organizationId:input.organizationId,permission:"equipment.manage"});
    const reason=input.reason.trim();if(!reason||reason.length>2000)throw new EquipmentRecallValidationError("Closure reason is required and must not exceed 2000 characters");
    return this.store.close({...input,reason,actorUserId:context.userId});
  }
}
