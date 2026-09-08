"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Status="OPEN"|"INVESTIGATING"|"ACTION_REQUIRED"|"VERIFICATION"|"CLOSED";
type EventRecord={id:string;eventNumber:string;type:string;severity:string;status:Status;summary:string;ownerUserId:string|null;dueAt:string|null;createdAt:string};

const nextStatus:Partial<Record<Status,Status>>={OPEN:"INVESTIGATING",INVESTIGATING:"ACTION_REQUIRED",ACTION_REQUIRED:"VERIFICATION"};

export function QualityEventWorkspace({canManage,today}:{canManage:boolean;today:string}){
  const [events,setEvents]=useState<EventRecord[]>([]);
  const [selectedId,setSelectedId]=useState("");
  const [reason,setReason]=useState("");
  const [ownerUserId,setOwnerUserId]=useState("");
  const [dueAt,setDueAt]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);

  async function load(){const response=await fetch("/api/quality/events",{credentials:"same-origin"});const body=await response.json().catch(()=>null);if(response.ok)setEvents(body?.data??[]);else setError(body?.error??"Unable to load quality events");}
  useEffect(()=>{void load();},[]);
  const selected=useMemo(()=>events.find(event=>event.id===selectedId)??null,[events,selectedId]);
  const overdue=(event:EventRecord)=>event.status!=="CLOSED"&&!!event.dueAt&&event.dueAt.slice(0,10)<today;

  async function update(payload:Record<string,unknown>){if(!selected)return;setBusy(true);setError("");const response=await fetch(`/api/quality/events/${selected.id}`,{method:"PATCH",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({reason,...payload})});const body=await response.json().catch(()=>null);setBusy(false);if(!response.ok){setError(body?.error??"Quality event update failed");return;}setReason("");setOwnerUserId("");setDueAt("");await load();}
  async function saveMetadata(event:FormEvent){event.preventDefault();const payload:Record<string,unknown>={};if(ownerUserId)payload.ownerUserId=ownerUserId;if(dueAt)payload.dueAt=dueAt;await update(payload);}

  return <section className="panel" aria-labelledby="quality-event-workspace-heading">
    <h2 id="quality-event-workspace-heading">Quality events</h2>
    <p>Operational incident and event workspace. Overdue is derived from the due date and does not change regulated event status.</p>
    {error&&<p role="alert">{error}</p>}
    <div style={{overflowX:"auto"}}><table><thead><tr><th>Event</th><th>Type</th><th>Severity</th><th>Status</th><th>Owner</th><th>Due</th></tr></thead><tbody>{events.map(event=><tr key={event.id}><td><button type="button" onClick={()=>setSelectedId(event.id)}>{event.eventNumber}</button><br/>{event.summary}</td><td>{event.type}</td><td>{event.severity}</td><td>{event.status}{overdue(event)?" · OVERDUE":""}</td><td>{event.ownerUserId??"Unassigned"}</td><td>{event.dueAt?.slice(0,10)??"—"}</td></tr>)}</tbody></table></div>
    {canManage&&selected&&<div>
      <h3>Governed lifecycle action — {selected.eventNumber}</h3>
      <label>Required reason<textarea value={reason} onChange={event=>setReason(event.target.value)} maxLength={1000}/></label>
      {nextStatus[selected.status]&&<button type="button" disabled={busy||!reason.trim()} onClick={()=>void update({status:nextStatus[selected.status]})}>Advance to {nextStatus[selected.status]}</button>}
      {selected.status==="VERIFICATION"&&<p>Closure is intentionally unavailable until the controlled closure/e-signature workflow is implemented.</p>}
      <form onSubmit={saveMetadata}>
        <label>Owner user ID<input value={ownerUserId} onChange={event=>setOwnerUserId(event.target.value)} placeholder="Active same-tenant user UUID"/></label>
        <label>Due date<input type="date" value={dueAt} onChange={event=>setDueAt(event.target.value)}/></label>
        <button type="submit" disabled={busy||!reason.trim()||(!ownerUserId&&!dueAt)}>Update assignment / due date</button>
      </form>
    </div>}
  </section>;
}
