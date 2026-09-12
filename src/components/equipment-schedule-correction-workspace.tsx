"use client";

import { useEffect,useMemo,useState } from "react";

type EquipmentItem={
  id:string;
  equipmentNumber:string;
  name:string;
  status:"PLANNED"|"ACTIVE"|"OUT_OF_SERVICE"|"RETIRED";
  calibrationRequired:boolean;
  maintenanceRequired:boolean;
  nextCalibrationDueAt:string|null;
  nextMaintenanceDueAt:string|null;
};

const datePattern=/^\d{4}-\d{2}-\d{2}$/;
function normalizedDate(value:string|null|undefined){return value?.slice(0,10)??"";}
function validGovernedDate(value:string){
  if(!datePattern.test(value))return false;
  const year=Number(value.slice(0,4));
  if(year<1900||year>9999)return false;
  const parsed=new Date(`${value}T12:00:00.000Z`);
  return !Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;
}

export function EquipmentScheduleCorrectionWorkspace(){
  const [equipment,setEquipment]=useState<EquipmentItem[]>([]);
  const [selected,setSelected]=useState("");
  const [nextCalibrationDueAt,setNextCalibrationDueAt]=useState("");
  const [nextMaintenanceDueAt,setNextMaintenanceDueAt]=useState("");
  const [reason,setReason]=useState("");
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const selectedItem=useMemo(()=>equipment.find(item=>item.id===selected)??null,[equipment,selected]);

  function applySchedule(item:EquipmentItem|null){
    setNextCalibrationDueAt(normalizedDate(item?.nextCalibrationDueAt));
    setNextMaintenanceDueAt(normalizedDate(item?.nextMaintenanceDueAt));
  }

  async function loadEquipment(preferredId?:string){
    const response=await fetch("/api/equipment/operations",{cache:"no-store"});
    const body=await response.json().catch(()=>null);
    if(!response.ok){setError(body?.error??"Unable to load equipment");return;}
    const items:EquipmentItem[]=(body?.data?.equipment??[]).filter((item:EquipmentItem)=>item.status!=="RETIRED");
    setEquipment(items);
    const nextSelected=preferredId&&items.some(item=>item.id===preferredId)?preferredId:items[0]?.id??"";
    setSelected(nextSelected);
    applySchedule(items.find(item=>item.id===nextSelected)??null);
    setError("");
  }

  useEffect(()=>{let cancelled=false;async function initialLoad(){
    const response=await fetch("/api/equipment/operations",{cache:"no-store"});
    const body=await response.json().catch(()=>null);
    if(cancelled)return;
    if(!response.ok){setError(body?.error??"Unable to load equipment");return;}
    const items:EquipmentItem[]=(body?.data?.equipment??[]).filter((item:EquipmentItem)=>item.status!=="RETIRED");
    const first=items[0]??null;
    setEquipment(items);setSelected(first?.id??"");applySchedule(first);
  }void initialLoad();return()=>{cancelled=true;};},[]);

  function changeEquipment(equipmentId:string){
    setSelected(equipmentId);setMessage("");setReason("");
    applySchedule(equipment.find(item=>item.id===equipmentId)??null);
  }

  async function correctSchedule(event:React.FormEvent){
    event.preventDefault();
    if(!selected||!selectedItem)return;
    if(selectedItem.calibrationRequired&&!validGovernedDate(nextCalibrationDueAt)){setMessage("Enter the next calibration due date as YYYY-MM-DD using a year from 1900 through 9999.");return;}
    if(selectedItem.maintenanceRequired&&!validGovernedDate(nextMaintenanceDueAt)){setMessage("Enter the next maintenance due date as YYYY-MM-DD using a year from 1900 through 9999.");return;}
    setMessage("");
    const response=await fetch(`/api/equipment/${selected}`,{
      method:"PATCH",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({
        operation:"CORRECT_SCHEDULE",
        nextCalibrationDueAt:selectedItem.calibrationRequired?nextCalibrationDueAt||null:null,
        nextMaintenanceDueAt:selectedItem.maintenanceRequired?nextMaintenanceDueAt||null:null,
        reason,
      }),
    });
    const body=await response.json().catch(()=>null);
    setMessage(response.ok?"Equipment compliance schedule corrected with governed audit history.":body?.error??"Equipment schedule correction failed");
    if(response.ok){
      const changedEquipmentId=selected;
      setReason("");
      await loadEquipment(changedEquipmentId);
      window.dispatchEvent(new CustomEvent("qms:equipment-changed",{detail:{equipmentId:changedEquipmentId}}));
    }
  }

  const calibrationMissing=Boolean(selectedItem?.calibrationRequired)&&!nextCalibrationDueAt.trim();
  const maintenanceMissing=Boolean(selectedItem?.maintenanceRequired)&&!nextMaintenanceDueAt.trim();
  const missingReason=!reason.trim();

  return <section className="card form-stack equipment-register-style">
    <h3>Correct compliance schedule</h3>
    <p>Correct an equipment calibration or maintenance due date when a documented data-entry error is identified. A required reason and before/after values are preserved in the audit trail and Operational history.</p>
    <form className="admin-form equipment-admin-form" onSubmit={correctSchedule}>
      <label>Equipment<select required value={selected} onChange={event=>changeEquipment(event.target.value)} disabled={!equipment.length}>{equipment.length?equipment.map(item=><option key={item.id} value={item.id}>{item.equipmentNumber} — {item.name}</option>):<option value="">No equipment registered</option>}</select></label>
      {selectedItem&&<p className="equipment-form-span"><strong>Current calibration due:</strong> {normalizedDate(selectedItem.nextCalibrationDueAt)||"—"} · <strong>Current maintenance due:</strong> {normalizedDate(selectedItem.nextMaintenanceDueAt)||"—"}</p>}
      <label>Next calibration due<input type="text" inputMode="numeric" placeholder="YYYY-MM-DD" required={Boolean(selectedItem?.calibrationRequired)} disabled={!selectedItem?.calibrationRequired} value={nextCalibrationDueAt} onChange={event=>setNextCalibrationDueAt(event.target.value)} maxLength={10} aria-describedby="equipment-calibration-date-help"/><span id="equipment-calibration-date-help" className="field-help">YYYY-MM-DD. Existing legacy values remain editable so they can be corrected through this governed workflow.</span></label>
      <label>Next maintenance due<input type="text" inputMode="numeric" placeholder="YYYY-MM-DD" required={Boolean(selectedItem?.maintenanceRequired)} disabled={!selectedItem?.maintenanceRequired} value={nextMaintenanceDueAt} onChange={event=>setNextMaintenanceDueAt(event.target.value)} maxLength={10} aria-describedby="equipment-maintenance-date-help"/><span id="equipment-maintenance-date-help" className="field-help">YYYY-MM-DD. Enter the intended corrected due date; this does not record completed maintenance.</span></label>
      <label className="equipment-form-wide">Required correction reason<textarea required rows={3} maxLength={1000} value={reason} onChange={event=>setReason(event.target.value)}/></label>
      {(calibrationMissing||maintenanceMissing||missingReason)&&selectedItem&&<p className="equipment-form-span" role="status">To save this governed correction, complete {calibrationMissing?"the next calibration due date":maintenanceMissing?"the next maintenance due date":"the required correction reason"}.</p>}
      <button type="submit" disabled={!selected||calibrationMissing||maintenanceMissing||missingReason}>Save governed schedule correction</button>
      {message&&<p className="equipment-form-span" role="status">{message}</p>}
      {error&&<p className="status-error equipment-form-span">{error}</p>}
    </form>
  </section>;
}
