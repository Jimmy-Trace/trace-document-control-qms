"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Status="OPEN"|"INVESTIGATING"|"ACTION_REQUIRED"|"VERIFICATION"|"CLOSED";
type EventRecord={id:string;eventNumber:string;type:string;severity:string;status:Status;summary:string;ownerUserId:string|null;dueAt:string|null;createdAt:string};
type Analytics={total:number;open:number;overdue:number;closed:number;byType:Array<{type:string;count:number}>;monthly:Array<{month:string;count:number}>};

const nextStatus:Partial<Record<Status,Status>>={OPEN:"INVESTIGATING",INVESTIGATING:"ACTION_REQUIRED",ACTION_REQUIRED:"VERIFICATION"};

export function QualityEventWorkspace({canManage,today}:{canManage:boolean;today:string}){
  const [events,setEvents]=useState<EventRecord[]>([]);
  const [analytics,setAnalytics]=useState<Analytics|null>(null);
  const [selectedId,setSelectedId]=useState("");
  const [reason,setReason]=useState("");
  const [ownerUserId,setOwnerUserId]=useState("");
  const [dueAt,setDueAt]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);

  async function load(){
    const [eventsResponse,analyticsResponse]=await Promise.all([
      fetch("/api/quality/events",{credentials:"same-origin"}),
      fetch("/api/quality/events/analytics?months=12",{credentials:"same-origin"}),
    ]);
    const eventsBody=await eventsResponse.json().catch(()=>null);
    const analyticsBody=await analyticsResponse.json().catch(()=>null);
    if(eventsResponse.ok)setEvents(eventsBody?.data??[]);else setError(eventsBody?.error??"Unable to load quality events");
    if(analyticsResponse.ok)setAnalytics(analyticsBody?.data??null);
  }
  useEffect(()=>{
    let active=true;
    Promise.all([
      fetch("/api/quality/events",{credentials:"same-origin"}),
      fetch("/api/quality/events/analytics?months=12",{credentials:"same-origin"}),
    ]).then(async([eventsResponse,analyticsResponse])=>({
      eventsResponse,
      analyticsResponse,
      eventsBody:await eventsResponse.json().catch(()=>null),
      analyticsBody:await analyticsResponse.json().catch(()=>null),
    })).then(({eventsResponse,analyticsResponse,eventsBody,analyticsBody})=>{
      if(!active)return;
      if(eventsResponse.ok)setEvents(eventsBody?.data??[]);else setError(eventsBody?.error??"Unable to load quality events");
      if(analyticsResponse.ok)setAnalytics(analyticsBody?.data??null);
    });
    return()=>{active=false;};
  },[]);
  const selected=useMemo(()=>events.find(event=>event.id===selectedId)??null,[events,selectedId]);
  const overdue=(event:EventRecord)=>event.status!=="CLOSED"&&!!event.dueAt&&event.dueAt.slice(0,10)<today;

  async function update(payload:Record<string,unknown>){if(!selected)return;setBusy(true);setError("");const response=await fetch(`/api/quality/events/${selected.id}`,{method:"PATCH",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({reason,...payload})});const body=await response.json().catch(()=>null);setBusy(false);if(!response.ok){setError(body?.error??"Quality event update failed");return;}setReason("");setOwnerUserId("");setDueAt("");await load();}
  async function saveMetadata(event:FormEvent){event.preventDefault();const payload:Record<string,unknown>={};if(ownerUserId)payload.ownerUserId=ownerUserId;if(dueAt)payload.dueAt=dueAt;await update(payload);}

  return <section className="panel" aria-labelledby="quality-event-workspace-heading">
    <h2 id="quality-event-workspace-heading">Quality events</h2>
    <p>Operational incident and event workspace. Overdue is derived from the due date and does not change regulated event status.</p>
    {analytics&&<div>
      <h3>12-month quality event rollup</h3>
      <p>Total: <strong>{analytics.total}</strong> · Open: <strong>{analytics.open}</strong> · Overdue: <strong>{analytics.overdue}</strong> · Closed: <strong>{analytics.closed}</strong></p>
      {analytics.byType.length>0&&<p>Leading event types: {analytics.byType.slice(0,5).map(item=>`${item.type} (${item.count})`).join(" · ")}</p>}
      {analytics.monthly.length>0&&<p>Monthly trend: {analytics.monthly.map(item=>`${item.month}: ${item.count}`).join(" · ")}</p>}
    </div>}
    {error&&<p role="alert">{error}</p>}
    <div style={{overflowX:"auto"}}><table><thead><tr><th>Event</th><th>Type</th><th>Severity</th><th>Status</th><th>Owner</th><th>Due</th></tr></thead><tbody>{events.map(event=><tr key={event.id}><td><button type="button" onClick={()=>setSelectedId(event.id)}>{event.eventNumber}</button><br/>{event.summary}</td><td>{event.type}</td><td>{event.severity}</td><td>{event.status}{overdue(event)?" · OVERDUE":""}</td><td>{event.ownerUserId??"Unassigned"}</td><td>{event.dueAt?.slice(0,10)??"—"}</td></tr>)}</tbody></table></div>
    {canManage&&selected&&<div>
      <h3>Governed lifecycle action — {selected.eventNumber}</h3>
      <label>Required reason<textarea value={reason} onChange={event=>setReason(event.target.value)} maxLength={1000}/></label>
      {nextStatus[selected.status]&&<button type="button" disabled={busy||!reason.trim()} onClick={()=>void update({status:nextStatus[selected.status]})}>Advance to {nextStatus[selected.status]}</button>}
      {selected.status==="VERIFICATION"&&<p>Final closure requires the controlled closure and electronic-signature workflow.</p>}
      <form onSubmit={saveMetadata}>
        <label>Owner user ID<input value={ownerUserId} onChange={event=>setOwnerUserId(event.target.value)} placeholder="Active same-tenant user UUID"/></label>
        <label>Due date<input type="date" value={dueAt} onChange={event=>setDueAt(event.target.value)}/></label>
        <button type="submit" disabled={busy||!reason.trim()||(!ownerUserId&&!dueAt)}>Update assignment / due date</button>
      </form>
    </div>}
  </section>;
}
