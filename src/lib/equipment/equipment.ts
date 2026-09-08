import type { AuthorizationContext } from "../security/authorization";
import { requireAuthorization } from "../security/authorization";

export class EquipmentValidationError extends Error {}
export type EquipmentStatus="PLANNED"|"ACTIVE"|"OUT_OF_SERVICE"|"RETIRED";
export type EquipmentEventType="RECEIVED"|"QUALIFIED"|"CALIBRATED"|"MAINTENANCE"|"SERVICE"|"OUT_OF_SERVICE"|"RETURNED_TO_SERVICE"|"RETIRED";
export type EquipmentRecord={id:string;organizationId:string;equipmentNumber:string;name:string;manufacturer:string|null;model:string|null;serialNumber:string|null;siteId:string|null;departmentId:string|null;status:EquipmentStatus;receivedAt:Date|null;placedInServiceAt:Date|null;calibrationRequired:boolean;calibrationIntervalDays:number|null;nextCalibrationDueAt:Date|null;maintenanceRequired:boolean;maintenanceIntervalDays:number|null;nextMaintenanceDueAt:Date|null;createdByUserId:string;createdAt:Date;updatedAt:Date};
export type EquipmentEventRecord={id:string;organizationId:string;equipmentId:string;eventType:EquipmentEventType;occurredAt:Date;summary:string;evidenceFileId:string|null;performedByUserId:string|null;createdByUserId:string;createdAt:Date};

export interface EquipmentStore{
  list(organizationId:string):Promise<EquipmentRecord[]>;
  create(input:{organizationId:string;equipmentNumber:string;name:string;manufacturer:string|null;model:string|null;serialNumber:string|null;siteId:string|null;departmentId:string|null;receivedAt:Date|null;calibrationRequired:boolean;calibrationIntervalDays:number|null;nextCalibrationDueAt:Date|null;maintenanceRequired:boolean;maintenanceIntervalDays:number|null;nextMaintenanceDueAt:Date|null;actorUserId:string}):Promise<EquipmentRecord>;
  listEvents(organizationId:string,equipmentId:string):Promise<EquipmentEventRecord[]>;
  addEvent(input:{organizationId:string;equipmentId:string;eventType:EquipmentEventType;occurredAt:Date;summary:string;evidenceFileId:string|null;performedByUserId:string|null;actorUserId:string}):Promise<EquipmentEventRecord>;
}

export class EquipmentService{
  constructor(private readonly store:EquipmentStore){}
  list(context:AuthorizationContext,organizationId:string){requireAuthorization(context,{organizationId,permission:"equipment.read"});return this.store.list(organizationId);}
  create(context:AuthorizationContext,input:{organizationId:string;equipmentNumber:string;name:string;manufacturer?:string|null;model?:string|null;serialNumber?:string|null;siteId?:string|null;departmentId?:string|null;receivedAt?:Date|null;calibrationRequired?:boolean;calibrationIntervalDays?:number|null;nextCalibrationDueAt?:Date|null;maintenanceRequired?:boolean;maintenanceIntervalDays?:number|null;nextMaintenanceDueAt?:Date|null}){
    requireAuthorization(context,{organizationId:input.organizationId,permission:"equipment.manage"});
    const equipmentNumber=input.equipmentNumber.trim(); const name=input.name.trim();
    if(!equipmentNumber||equipmentNumber.length>80)throw new EquipmentValidationError("Equipment number is required and must not exceed 80 characters");
    if(!name||name.length>240)throw new EquipmentValidationError("Equipment name is required and must not exceed 240 characters");
    const calibrationRequired=input.calibrationRequired??false, maintenanceRequired=input.maintenanceRequired??false;
    if(calibrationRequired&&(!input.calibrationIntervalDays||input.calibrationIntervalDays<1))throw new EquipmentValidationError("Calibration interval is required for calibration-controlled equipment");
    if(maintenanceRequired&&(!input.maintenanceIntervalDays||input.maintenanceIntervalDays<1))throw new EquipmentValidationError("Maintenance interval is required for maintenance-controlled equipment");
    return this.store.create({...input,equipmentNumber,name,manufacturer:input.manufacturer?.trim()||null,model:input.model?.trim()||null,serialNumber:input.serialNumber?.trim()||null,siteId:input.siteId??null,departmentId:input.departmentId??null,receivedAt:input.receivedAt??null,calibrationRequired,calibrationIntervalDays:calibrationRequired?input.calibrationIntervalDays??null:null,nextCalibrationDueAt:calibrationRequired?input.nextCalibrationDueAt??null:null,maintenanceRequired,maintenanceIntervalDays:maintenanceRequired?input.maintenanceIntervalDays??null:null,nextMaintenanceDueAt:maintenanceRequired?input.nextMaintenanceDueAt??null:null,actorUserId:context.userId});
  }
  listEvents(context:AuthorizationContext,organizationId:string,equipmentId:string){requireAuthorization(context,{organizationId,permission:"equipment.read"});return this.store.listEvents(organizationId,equipmentId);}
  addEvent(context:AuthorizationContext,input:{organizationId:string;equipmentId:string;eventType:EquipmentEventType;occurredAt:Date;summary:string;evidenceFileId?:string|null;performedByUserId?:string|null}){
    requireAuthorization(context,{organizationId:input.organizationId,permission:"equipment.manage"});
    const summary=input.summary.trim(); if(!summary||summary.length>5000)throw new EquipmentValidationError("Equipment event summary is required and must not exceed 5000 characters");
    if(Number.isNaN(input.occurredAt.getTime()))throw new EquipmentValidationError("Equipment event time is invalid");
    return this.store.addEvent({...input,summary,evidenceFileId:input.evidenceFileId??null,performedByUserId:input.performedByUserId??null,actorUserId:context.userId});
  }
}
