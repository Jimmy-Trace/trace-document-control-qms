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
    setNextCalibrationDueAt(item?.nextCalibrationDueAt?.slice(0,10)??"");
    setNextMaintenanceDueAt(item?.nextMaintenanceDueAt?.slice(0,10)??"");
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

  return <section className="card form-stack equipment-register-style">
    <h3>Correct compliance schedule</h3>
    <p>Correct an equipment calibration or maintenance due date when a documented data-entry error is identified. A required reason and before/after values are preserved in the audit trail and Operational history.</p>
    <form className="admin-form equipment-admin-form" onSubmit={correctSchedule}>
      <label>Equipment<select required value={selected} onChange={event=>changeEquipment(event.target.value)} disabled={!equipment.length}>{equipment.length?equipment.map(item=><option key={item.id} value={item.id}>{item.equipmentNumber} — {item.name}</option>):<option value="">No equipment registered</option>}</select></label>
      {selectedItem&&<p className="equipment-form-span"><strong>Current calibration due:</strong> {selectedItem.nextCalibrationDueAt?.slice(0,10)??"—"} · <strong>Current maintenance due:</strong> {selectedItem.nextMaintenanceDueAt?.slice(0,10)??"—"}</p>}
      <label>Next calibration due<input type="date" required={Boolean(selectedItem?.calibrationRequired)} disabled={!selectedItem?.calibrationRequired} value={nextCalibrationDueAt} onChange={event=>setNextCalibrationDueAt(event.target.value)}/></label>
      <label>Next maintenance due<input type="date" required={Boolean(selectedItem?.maintenanceRequired)} disabled={!selectedItem?.maintenanceRequired} value={nextMaintenanceDueAt} onChange={event=>setNextMaintenanceDueAt(event.target.value)}/></label>
      <label className="equipment-form-wide">Required correction reason<textarea required rows={3} maxLength={1000} value={reason} onChange={event=>setReason(event.target.value)}/></label>
      <button type="submit" disabled={!selected||!reason.trim()||(Boolean(selectedItem?.calibrationRequired)&&!nextCalibrationDueAt)||(Boolean(selectedItem?.maintenanceRequired)&&!nextMaintenanceDueAt)}>Save governed schedule correction</button>
      {message&&<p className="equipment-form-span" role="status">{message}</p>}
      {error&&<p className="status-error equipment-form-span">{error}</p>}
    </form>
  </section>;
}
