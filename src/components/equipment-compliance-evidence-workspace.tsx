"use client";

import { useEffect,useMemo,useState } from "react";
import { GovernedEvidenceFilePicker } from "./governed-evidence-file-picker";

type EquipmentItem={
  id:string;
  equipmentNumber:string;
  name:string;
  status:"PLANNED"|"ACTIVE"|"OUT_OF_SERVICE"|"RETIRED";
  nextCalibrationDueAt:string|null;
  nextMaintenanceDueAt:string|null;
};
type EventType="CALIBRATED"|"MAINTENANCE";

export function EquipmentComplianceEvidenceWorkspace({today}:{today:string}){
  const [equipment,setEquipment]=useState<EquipmentItem[]>([]);
  const [selected,setSelected]=useState("");
  const [eventType,setEventType]=useState<EventType>("CALIBRATED");
  const [eventDate,setEventDate]=useState(today);
  const [summary,setSummary]=useState("");
  const [evidenceFileId,setEvidenceFileId]=useState("");
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const selectedItem=useMemo(()=>equipment.find(item=>item.id===selected)??null,[equipment,selected]);

  async function loadEquipment(){
    const response=await fetch("/api/equipment/operations",{cache:"no-store"});
    const body=await response.json().catch(()=>null);
    if(!response.ok){setError(body?.error??"Unable to load equipment");return;}
    const activeItems=(body?.data?.equipment??[]).filter((item:EquipmentItem)=>item.status!=="RETIRED");
    setEquipment(activeItems);
    setSelected(current=>current&&activeItems.some((item:EquipmentItem)=>item.id===current)?current:activeItems[0]?.id??"");
  }

  useEffect(()=>{let cancelled=false;async function initialLoad(){
    const response=await fetch("/api/equipment/operations",{cache:"no-store"});
    const body=await response.json().catch(()=>null);
    if(cancelled)return;
    if(!response.ok){setError(body?.error??"Unable to load equipment");return;}
    const activeItems=(body?.data?.equipment??[]).filter((item:EquipmentItem)=>item.status!=="RETIRED");
    setEquipment(activeItems);setSelected(activeItems[0]?.id??"");
  }void initialLoad();return()=>{cancelled=true;};},[]);

  async function recordEvidence(event:React.FormEvent){
    event.preventDefault();
    if(!selected||!evidenceFileId)return;
    setMessage("");
    const occurredAt=new Date(`${eventDate}T12:00:00.000Z`).toISOString();
    const response=await fetch(`/api/equipment/${selected}/events`,{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({eventType,occurredAt,summary,evidenceFileId}),
    });
    const body=await response.json().catch(()=>null);
    const label=eventType==="CALIBRATED"?"Calibration":"Maintenance";
    setMessage(response.ok?`${label} evidence recorded and next due date advanced from the governed interval.`:body?.error??`${label} evidence could not be recorded`);
    if(response.ok){setSummary("");setEvidenceFileId("");await loadEquipment();}
  }

  return <section className="card form-stack">
    <h3>Calibration & maintenance evidence</h3>
    <p>Record completed calibration or preventive maintenance with governed supporting evidence. The next due date is calculated from the recorded event date and the equipment&apos;s configured interval.</p>
    <form className="form-stack" onSubmit={recordEvidence}>
      <label>Equipment<select required value={selected} onChange={event=>{setSelected(event.target.value);setMessage("");setEvidenceFileId("");}} disabled={!equipment.length}>{equipment.length?equipment.map(item=><option key={item.id} value={item.id}>{item.equipmentNumber} — {item.name}</option>):<option value="">Register equipment first</option>}</select></label>
      {selectedItem&&<p><strong>Current calibration due:</strong> {selectedItem.nextCalibrationDueAt?.slice(0,10)??"—"} · <strong>Current maintenance due:</strong> {selectedItem.nextMaintenanceDueAt?.slice(0,10)??"—"}</p>}
      <label>Evidence type<select value={eventType} onChange={event=>{setEventType(event.target.value as EventType);setMessage("");setEvidenceFileId("");}}><option value="CALIBRATED">Calibration completed</option><option value="MAINTENANCE">Preventive maintenance completed</option></select></label>
      <label>Completed date<input required type="date" value={eventDate} onChange={event=>setEventDate(event.target.value)}/></label>
      <label style={{width:"100%"}}>Evidence summary<textarea required rows={3} maxLength={5000} value={summary} onChange={event=>setSummary(event.target.value)} style={{width:"100%",boxSizing:"border-box",resize:"vertical"}}/></label>
      <GovernedEvidenceFilePicker key={`${selected}:${eventType}`} domain="equipment" name="equipmentComplianceEvidenceFileId" onSelectionChange={setEvidenceFileId}/>
      <button type="submit" disabled={!selected||!eventDate||!summary.trim()||!evidenceFileId}>Record governed evidence</button>
      {message&&<p role="status">{message}</p>}
      {error&&<p className="status-error">{error}</p>}
    </form>
  </section>;
}
